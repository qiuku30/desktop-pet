// 2048 游戏核心逻辑 — 纯函数，不碰 DOM / PetState
//
// 职责：
// - 棋盘初始化（4×4，初始 2 个方块）
// - 滑动合并（上下左右，标准 2048 规则）
// - 随机新方块生成（90% 2, 10% 4）
// - Game Over 检测
// - 最大方块追踪
// - 序列化 / 反序列化

const SIZE = 4

// ── 棋盘操作 ──

function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
}

function getEmptyCells(board) {
  const cells = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) cells.push([r, c])
    }
  }
  return cells
}

/** 在随机空格放置新方块（90% 2, 10% 4）。原地修改，返回 true 表示成功 */
export function addRandomTile(board) {
  const empty = getEmptyCells(board)
  if (empty.length === 0) return false
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]
  board[r][c] = Math.random() < 0.9 ? 2 : 4
  return true
}

// ── 核心滑动逻辑 ──

/**
 * 将一行向左滑动（压缩 → 合并 → 再压缩）
 * 返回 { row: number[], points: number }
 */
function slideRowLeft(row) {
  let tiles = row.filter(v => v !== 0)
  let points = 0

  for (let i = 0; i < tiles.length - 1; i++) {
    if (tiles[i] === tiles[i + 1]) {
      tiles[i] *= 2
      points += tiles[i]
      tiles[i + 1] = 0
      i++ // 跳过被合并的格子
    }
  }

  tiles = tiles.filter(v => v !== 0)
  while (tiles.length < SIZE) tiles.push(0)

  return { row: tiles, points }
}

/**
 * 执行一次移动。无法移动返回 null。
 * @param {object} game — { board, score, gameOver, maxTile }
 * @param {'up'|'down'|'left'|'right'} direction
 * @returns {object|null}
 */
export function move(game, direction) {
  const { board } = game
  const newBoard = emptyBoard()
  let points = 0

  for (let i = 0; i < SIZE; i++) {
    const extracted = []
    for (let j = 0; j < SIZE; j++) {
      switch (direction) {
        case 'left':  extracted.push(board[i][j]);            break
        case 'right': extracted.push(board[i][SIZE - 1 - j]); break
        case 'up':    extracted.push(board[j][i]);            break
        case 'down':  extracted.push(board[SIZE - 1 - j][i]); break
      }
    }

    const result = slideRowLeft(extracted)
    points += result.points

    for (let j = 0; j < SIZE; j++) {
      switch (direction) {
        case 'left':  newBoard[i][j]            = result.row[j]; break
        case 'right': newBoard[i][SIZE - 1 - j] = result.row[j]; break
        case 'up':    newBoard[j][i]            = result.row[j]; break
        case 'down':  newBoard[SIZE - 1 - j][i] = result.row[j]; break
      }
    }
  }

  if (boardsEqual(board, newBoard)) return null

  addRandomTile(newBoard)

  const newScore = game.score + points
  const newMaxTile = Math.max(game.maxTile, maxTileOf(newBoard))
  const gameOver = isGameOver(newBoard)

  return {
    board: newBoard,
    score: newScore,
    gameOver,
    maxTile: newMaxTile,
    pointsEarned: points,
  }
}

// ── 查询 ──

/** 判断是否 Game Over（无空格且无合法移动） */
export function isGameOver(board) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) return false
      if (c < SIZE - 1 && board[r][c] === board[r][c + 1]) return false
      if (r < SIZE - 1 && board[r][c] === board[r + 1][c]) return false
    }
  }
  return true
}

/** 棋盘最大方块值 */
export function maxTileOf(board) {
  let max = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] > max) max = board[r][c]
    }
  }
  return max
}

// ── 序列化 ──

/**
 * 序列化为可持久化纯对象
 * @param {object} game — { board, score, gameOver, maxTile, rewardsClaimed? }
 */
export function serialize(game) {
  return {
    board: game.board.map(row => [...row]),
    score: game.score,
    gameOver: game.gameOver,
    maxTile: game.maxTile,
    rewardsClaimed: game.rewardsClaimed || false,
  }
}

/**
 * 反序列化恢复游戏状态。校验失败返回 null。
 * @param {object} data
 * @returns {object|null}
 */
export function deserialize(data) {
  if (!data || !Array.isArray(data.board) || data.board.length !== SIZE) return null
  const board = data.board.map(row => {
    if (!Array.isArray(row) || row.length !== SIZE) return null
    return [...row]
  })
  if (board.some(row => row === null)) return null

  return {
    board,
    score: typeof data.score === 'number' ? data.score : 0,
    gameOver: Boolean(data.gameOver),
    maxTile: typeof data.maxTile === 'number' ? data.maxTile : maxTileOf(board),
    rewardsClaimed: Boolean(data.rewardsClaimed),
  }
}

// ── 创建新游戏 ──

/** 创建全新游戏 */
export function createGame() {
  const board = emptyBoard()
  addRandomTile(board)
  addRandomTile(board)
  return {
    board,
    score: 0,
    gameOver: false,
    maxTile: maxTileOf(board),
    rewardsClaimed: false,
  }
}

// ── 内部 ──

function boardsEqual(a, b) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false
    }
  }
  return true
}
