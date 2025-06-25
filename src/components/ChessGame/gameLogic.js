// --- START OF FILE gameLogic.js ---

// 定义棋子类型和颜色
export const PIECE_TYPES = {
  // 黑方 (Black)
  JU: '車', MA: '马', XIANG: '相', SHI: '士', JIANG: '将', PAO: '炮', BING: '兵',
  // 红方 (Red)
  CHE: '车', MA_B: '马', XIANG_B: '象', SHI_B: '仕', SHUAI: '帅', PAO_B: '炮', ZU: '卒',
};

export const PIECE_COLOR = { RED: 'red', BLACK: 'black' };

// 棋盘初始布局 (y: 0-9, x: 0-8)
export const getInitialBoard = () => [
  [{ type: PIECE_TYPES.JU, color: PIECE_COLOR.BLACK }, { type: PIECE_TYPES.MA, color: PIECE_COLOR.BLACK }, { type: PIECE_TYPES.XIANG, color: PIECE_COLOR.BLACK }, { type: PIECE_TYPES.SHI, color: PIECE_COLOR.BLACK }, { type: PIECE_TYPES.JIANG, color: PIECE_COLOR.BLACK }, { type: PIECE_TYPES.SHI, color: PIECE_COLOR.BLACK }, { type: PIECE_TYPES.XIANG, color: PIECE_COLOR.BLACK }, { type: PIECE_TYPES.MA, color: PIECE_COLOR.BLACK }, { type: PIECE_TYPES.JU, color: PIECE_COLOR.BLACK }],
  Array(9).fill(null), // Empty row
  [null, { type: PIECE_TYPES.PAO, color: PIECE_COLOR.BLACK }, null, null, null, null, null, { type: PIECE_TYPES.PAO, color: PIECE_COLOR.BLACK }, null],
  [{ type: PIECE_TYPES.BING, color: PIECE_COLOR.BLACK }, null, { type: PIECE_TYPES.BING, color: PIECE_COLOR.BLACK }, null, { type: PIECE_TYPES.BING, color: PIECE_COLOR.BLACK }, null, { type: PIECE_TYPES.BING, color: PIECE_COLOR.BLACK }, null, { type: PIECE_TYPES.BING, color: PIECE_COLOR.BLACK }],
  Array(9).fill(null), // Empty row
  Array(9).fill(null), // Empty row
  [{ type: PIECE_TYPES.ZU, color: PIECE_COLOR.RED }, null, { type: PIECE_TYPES.ZU, color: PIECE_COLOR.RED }, null, { type: PIECE_TYPES.ZU, color: PIECE_COLOR.RED }, null, { type: PIECE_TYPES.ZU, color: PIECE_COLOR.RED }, null, { type: PIECE_TYPES.ZU, color: PIECE_COLOR.RED }],
  [null, { type: PIECE_TYPES.PAO_B, color: PIECE_COLOR.RED }, null, null, null, null, null, { type: PIECE_TYPES.PAO_B, color: PIECE_COLOR.RED }, null],
  Array(9).fill(null), // Empty row
  [{ type: PIECE_TYPES.CHE, color: PIECE_COLOR.RED }, { type: PIECE_TYPES.MA_B, color: PIECE_COLOR.RED }, { type: PIECE_TYPES.XIANG_B, color: PIECE_COLOR.RED }, { type: PIECE_TYPES.SHI_B, color: PIECE_COLOR.RED }, { type: PIECE_TYPES.SHUAI, color: PIECE_COLOR.RED }, { type: PIECE_TYPES.SHI_B, color: PIECE_COLOR.RED }, { type: PIECE_TYPES.XIANG_B, color: PIECE_COLOR.RED }, { type: PIECE_TYPES.MA_B, color: PIECE_COLOR.RED }, { type: PIECE_TYPES.CHE, color: PIECE_COLOR.RED }],
].map(row => Array.from({ length: 9 }, (_, i) => row[i] || null));

/**
* 检查移动是否合法 - 仅检查棋子规则，不考虑将军
*/
export const isValidMove = (board, from, to) => {
  const piece = board[from.y][from.x];
  const targetPiece = board[to.y][to.x];

  if (!piece) return false;
  if (to.x < 0 || to.x > 8 || to.y < 0 || to.y > 9) return false; // 边界检查
  if (targetPiece && targetPiece.color === piece.color) return false;
  if (from.x === to.x && from.y === to.y) return false; // 不能原地踏步

  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);

  const countPiecesInPath = (start, end) => {
    let count = 0;
    if (start.x === end.x) { // 垂直移动
      for (let y = Math.min(start.y, end.y) + 1; y < Math.max(start.y, end.y); y++) {
        if (board[y][start.x]) count++;
      }
    } else if (start.y === end.y) { // 水平移动
      for (let x = Math.min(start.x, end.x) + 1; x < Math.max(start.x, end.x); x++) {
        if (board[start.y][x]) count++;
      }
    } else { // 斜线移动，炮车不会走到这里
      return -1; // 表示非直线路径
    }
    return count;
  };

  switch (piece.type) {
    case PIECE_TYPES.CHE:
    case PIECE_TYPES.JU:
      if (from.x !== to.x && from.y !== to.y) return false;
      return countPiecesInPath(from, to) === 0;

    case PIECE_TYPES.MA:
    case PIECE_TYPES.MA_B:
      if (!((dx === 1 && dy === 2) || (dx === 2 && dy === 1))) return false;
      // 蹩马腿检查
      if (dx === 1) { // 日字竖着走
        if (board[from.y + (to.y > from.y ? 1 : -1)][from.x]) return false;
      } else { // 日字横着走
        if (board[from.y][from.x + (to.x > from.x ? 1 : -1)]) return false;
      }
      return true;

    case PIECE_TYPES.XIANG:
    case PIECE_TYPES.XIANG_B:
      if (!(dx === 2 && dy === 2)) return false;
      // 不能过河
      if (piece.color === PIECE_COLOR.BLACK && to.y > 4) return false;
      if (piece.color === PIECE_COLOR.RED && to.y < 5) return false;
      // 塞象眼检查
      const eyeX = from.x + (to.x > from.x ? 1 : -1);
      const eyeY = from.y + (to.y > from.y ? 1 : -1);
      if (board[eyeY][eyeX]) return false;
      return true;

    case PIECE_TYPES.SHI:
    case PIECE_TYPES.SHI_B:
      if (!(dx === 1 && dy === 1)) return false;
      // 不能出九宫
      if (to.x < 3 || to.x > 5) return false;
      if (piece.color === PIECE_COLOR.BLACK && to.y > 2) return false;
      if (piece.color === PIECE_COLOR.RED && to.y < 7) return false;
      return true;
      
    case PIECE_TYPES.JIANG:
    case PIECE_TYPES.SHUAI:
      if (!((dx === 1 && dy === 0) || (dx === 0 && dy === 1))) return false;
      // 不能出九宫
      if (to.x < 3 || to.x > 5) return false;
      if (piece.color === PIECE_COLOR.BLACK && to.y > 2) return false;
      if (piece.color === PIECE_COLOR.RED && to.y < 7) return false;
      return true;

    case PIECE_TYPES.PAO:
    case PIECE_TYPES.PAO_B:
      if (from.x !== to.x && from.y !== to.y) return false;
      const piecesInPath = countPiecesInPath(from, to);
      if (targetPiece) { // 吃子
        return piecesInPath === 1; // 必须隔一个子
      } else { // 移动
        return piecesInPath === 0; // 不能隔子
      }

    case PIECE_TYPES.BING: // 黑兵
      if (to.y < from.y) return false; // 不能后退
      if (from.y < 5 && from.x !== to.x) return false; // 未过河不能横走
      return dx + dy === 1;

    case PIECE_TYPES.ZU: // 红卒
      if (to.y > from.y) return false; // 不能后退
      if (from.y > 4 && from.x !== to.x) return false; // 未过河不能横走
      return dx + dy === 1;

    default:
      return false;
  }
};

/**
* 检查指定颜色的王是否被将军
*/
export const isKingInCheck = (board, kingColor) => {
  const kingType = kingColor === PIECE_COLOR.RED ? PIECE_TYPES.SHUAI : PIECE_TYPES.JIANG;
  let kingPos = null;
  for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
          const piece = board[y][x];
          if (piece && piece.type === kingType && piece.color === kingColor) {
              kingPos = { x, y };
              break;
          }
      }
      if (kingPos) break;
  }
  if (!kingPos) return true; 

  const opponentColor = kingColor === PIECE_COLOR.RED ? PIECE_COLOR.BLACK : PIECE_COLOR.RED;
  for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
          const piece = board[y][x];
          if (piece && piece.color === opponentColor) {
              if (isValidMove(board, { x, y }, kingPos)) {
                  return true;
              }
          }
      }
  }

  const otherKingType = kingColor === PIECE_COLOR.RED ? PIECE_TYPES.JIANG : PIECE_TYPES.SHUAI;
  let otherKingPos = null;
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const piece = board[y][x];
      if (piece && piece.type === otherKingType && piece.color === opponentColor) {
        otherKingPos = { x, y };
        break;
      }
    }
    if (otherKingPos) break;
  }

  if (kingPos && otherKingPos && kingPos.x === otherKingPos.x) { 
    let count = 0;
    for (let y = Math.min(kingPos.y, otherKingPos.y) + 1; y < Math.max(kingPos.y, otherKingPos.y); y++) {
      if (board[y][kingPos.x]) {
        count++;
      }
    }
    if (count === 0) { 
      return true;
    }
  }

  return false;
};

/**
* 生成所有合法的走法（即移动后不会导致自己的王被将军）
*/
export const generateLegalMoves = (board, color, piecePos = null) => {
  const moves = [];
  const startY = piecePos ? piecePos.y : 0;
  const endY = piecePos ? piecePos.y + 1 : 10;
  const startX = piecePos ? piecePos.x : 0;
  const endX = piecePos ? piecePos.x + 1 : 9;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const currentPiece = board[y][x]; // Renamed 'piece' to 'currentPiece' to avoid conflict
      if (!currentPiece || currentPiece.color !== color) continue;

      for (let toY = 0; toY < 10; toY++) {
        for (let toX = 0; toX < 9; toX++) {
          const from = { x, y };
          const to = { x: toX, y: toY };
          
          if (isValidMove(board, from, to)) {
            const capturedPiece = board[to.y][to.x];
            board[to.y][to.x] = currentPiece; // Use currentPiece
            board[from.y][from.x] = null;
            
            if (!isKingInCheck(board, color)) {
              moves.push({ from, to });
            }

            board[from.y][from.x] = currentPiece; // Restore using currentPiece
            board[to.y][to.x] = capturedPiece;
          }
        }
      }
    }
  }
  return moves;
};