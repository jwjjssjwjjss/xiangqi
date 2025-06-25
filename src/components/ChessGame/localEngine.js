// --- START OF FILE localEngine.js ---

import { PIECE_COLOR, PIECE_TYPES, generateLegalMoves, isKingInCheck } from './gameLogic'; // 假设 gameLogic.js 在同一目录

// 1. 评估参数 (Evaluation Parameters)
const MATE_SCORE = 100000;
const INFINITY = 1000000;
const LOCAL_SEARCH_DEPTH = 7;
const LOCAL_MAX_THINKING_TIME = 1000; // 毫秒

const pieceBaseScores = {};
const piecePositionScores = {};
let pieceTablesInitialized = false;

export function initializePieceTables() {
    if (pieceTablesInitialized) return;
    Object.assign(pieceBaseScores, {
      [PIECE_TYPES.JIANG]: 10000, [PIECE_TYPES.SHUAI]: 10000,
      [PIECE_TYPES.SHI]: 120, [PIECE_TYPES.SHI_B]: 120,
      [PIECE_TYPES.XIANG]: 200, [PIECE_TYPES.XIANG_B]: 200,
      [PIECE_TYPES.MA]: 450, [PIECE_TYPES.MA_B]: 450,
      [PIECE_TYPES.JU]: 900, [PIECE_TYPES.CHE]: 900,
      [PIECE_TYPES.PAO]: 500, [PIECE_TYPES.PAO_B]:500,
      [PIECE_TYPES.BING]: 100, [PIECE_TYPES.ZU]: 100,
    });

    Object.assign(piecePositionScores, {
      [PIECE_TYPES.BING]:  [[9,9,9,11,13,11,9,9,9],[19,21,23,25,26,25,23,21,19],[19,21,23,25,26,25,23,21,19],[14,16,18,20,22,20,18,16,14],[9,11,13,14,16,14,13,11,9],[7,9,10,11,12,11,10,9,7],[4,5,6,7,8,7,6,5,4],[2,3,3,4,5,4,3,3,2],[0,1,1,2,2,2,1,1,0],[0,0,0,0,0,0,0,0,0]],
      [PIECE_TYPES.PAO]:   [[10,10,9,10,10,10,9,10,10],[10,10,9,10,10,10,9,10,10],[10,10,9,10,10,10,9,10,10],[10,10,9,10,10,10,9,10,10],[10,10,9,10,10,10,9,10,10],[9,9,8,9,9,9,8,9,9],[8,8,7,8,8,8,7,8,8],[7,7,6,7,7,7,6,7,7],[6,6,5,6,6,6,5,6,6],[5,5,4,5,5,5,4,5,5]],
      [PIECE_TYPES.MA]:    [[90,90,90,96,96,96,90,90,90],[90,96,100,103,104,103,100,96,90],[92,98,103,107,108,107,103,98,92],[93,100,105,109,112,109,105,100,93],[93,101,107,112,115,112,107,101,93],[93,100,106,111,114,111,106,100,93],[92,99,104,108,110,108,104,99,92],[90,95,98,100,102,100,98,95,90],[88,92,94,95,96,95,94,92,88],[87,90,90,92,92,92,90,90,87]],
      [PIECE_TYPES.JU]:    [[200,200,200,200,200,200,200,200,200],[200,205,205,205,205,205,205,205,200],[200,200,200,200,200,200,200,200,200],[200,200,200,200,200,200,200,200,200],[200,200,200,200,200,200,200,200,200],[195,195,195,195,195,195,195,195,195],[190,190,190,190,190,190,190,190,190],[185,185,185,185,185,185,185,185,185],[180,180,180,180,180,180,180,180,180],[175,175,175,175,175,175,175,175,175]],
      [PIECE_TYPES.XIANG]: [[0,0,20,0,0,0,20,0,0],[0,0,0,0,0,0,0,0,0],[0,0,20,0,0,0,20,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]],
      [PIECE_TYPES.SHI]:   [[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,20,0,20,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,20,0,20,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]],
      [PIECE_TYPES.JIANG]: [[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]],
    });
    piecePositionScores[PIECE_TYPES.ZU] = piecePositionScores[PIECE_TYPES.BING];
    piecePositionScores[PIECE_TYPES.PAO_B] = piecePositionScores[PIECE_TYPES.PAO];
    piecePositionScores[PIECE_TYPES.MA_B] = piecePositionScores[PIECE_TYPES.MA];
    piecePositionScores[PIECE_TYPES.CHE] = piecePositionScores[PIECE_TYPES.JU];
    piecePositionScores[PIECE_TYPES.SHI_B] = piecePositionScores[PIECE_TYPES.SHI];
    piecePositionScores[PIECE_TYPES.XIANG_B] = piecePositionScores[PIECE_TYPES.XIANG];
    piecePositionScores[PIECE_TYPES.SHUAI] = piecePositionScores[PIECE_TYPES.JIANG];
    pieceTablesInitialized = true;
    console.log("Local Engine: Piece score tables initialized.");
}


// 2. AI核心 (Zobrist, TT, Killers, History)
let zobristTable;
let zobristKey;
const transpositionTable = new Map();
const TT_FLAG = { EXACT: 0, LOWER_BOUND: 1, UPPER_BOUND: 2 };
const killerMoves = Array(LOCAL_SEARCH_DEPTH + 6).fill(null).map(() => [null, null]); // 深度 + 额外层级给静默搜索
const historyTable = Array(10).fill(null).map(() => Array(9).fill(null).map(() => Array(10).fill(null).map(() => Array(9).fill(0))));
let nodesSearched = 0;
let zobristInitialized = false;

function initZobristForLocalEngine() {
    if (zobristInitialized) return;
    zobristTable = Array(10).fill(null).map(() =>
        Array(9).fill(null).map(() => new Map())
    );
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            for (const color of [PIECE_COLOR.RED, PIECE_COLOR.BLACK]) {
                const allPieceTypes = new Set(Object.values(PIECE_TYPES));
                for (const type of allPieceTypes) {
                    const randomKey = (BigInt(Math.floor(Math.random() * 2**32)) << 32n) | BigInt(Math.floor(Math.random() * 2**32));
                    zobristTable[y][x].set(`${type}_${color}`, randomKey);
                }
            }
        }
    }
    zobristInitialized = true;
    console.log("Local Engine: Zobrist table initialized.");
};

function computeZobristKeyForLocalEngine(board) {
    if (!zobristInitialized) initZobristForLocalEngine();
    let key = 0n;
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const piece = board[y][x];
            if (piece) {
                if (typeof piece.type !== 'string' || typeof piece.color !== 'string') {
                    console.error("Local Engine: Invalid piece type or color found for Zobrist:", piece);
                    continue;
                }
                const zobristVal = zobristTable[y][x].get(`${piece.type}_${piece.color}`);
                if (zobristVal === undefined) {
                    console.error(`Local Engine: Zobrist key not found for piece: ${piece.type}_${piece.color} at (${x},${y})`);
                } else {
                    key ^= zobristVal;
                }
            }
        }
    }
    return key;
};

// 3. 走法执行和评估
function makeMoveLocal(board, move) {
    const piece = board[move.from.y][move.from.x];
    const capturedPiece = board[move.to.y][move.to.x];

    if (!piece) {
        console.error("Local Engine: No piece to move in makeMoveLocal at:", move.from, "Move:", move);
        return capturedPiece;
    }
    if (!zobristInitialized || !zobristTable[move.from.y]?.[move.from.x] || !zobristTable[move.to.y]?.[move.to.x]) {
        initZobristForLocalEngine();
        if (!zobristInitialized || !zobristTable[move.from.y]?.[move.from.x] || !zobristTable[move.to.y]?.[move.to.x]) {
             console.error("Local Engine: Zobrist re-init failed or insufficient for makeMoveLocal.");
        }
    }

    if (zobristTable[move.from.y]?.[move.from.x]?.get(`${piece.type}_${piece.color}`)) {
        zobristKey ^= zobristTable[move.from.y][move.from.x].get(`${piece.type}_${piece.color}`);
    }
    if (capturedPiece && zobristTable[move.to.y]?.[move.to.x]?.get(`${capturedPiece.type}_${capturedPiece.color}`)) {
        zobristKey ^= zobristTable[move.to.y][move.to.x].get(`${capturedPiece.type}_${capturedPiece.color}`);
    }

    board[move.to.y][move.to.x] = piece;
    board[move.from.y][move.from.x] = null;

    if (zobristTable[move.to.y]?.[move.to.x]?.get(`${piece.type}_${piece.color}`)) {
        zobristKey ^= zobristTable[move.to.y][move.to.x].get(`${piece.type}_${piece.color}`);
    }
    return capturedPiece;
};

function unmakeMoveLocal(board, move, capturedPiece) {
    const piece = board[move.to.y][move.to.x];

    if (!piece) {
        console.error("Local Engine: No piece to unmove in unmakeMoveLocal at:", move.to, "Move:", move);
        board[move.from.y][move.from.x] = null;
        board[move.to.y][move.to.x] = capturedPiece;
        if (zobristInitialized && capturedPiece && zobristTable[move.to.y]?.[move.to.x]?.get(`${capturedPiece.type}_${capturedPiece.color}`)) {
            zobristKey ^= zobristTable[move.to.y][move.to.x].get(`${capturedPiece.type}_${capturedPiece.color}`);
        }
        return;
    }
     if (!zobristInitialized || !zobristTable[move.from.y]?.[move.from.x] || !zobristTable[move.to.y]?.[move.to.x]) {
        initZobristForLocalEngine();
         if (!zobristInitialized || !zobristTable[move.from.y]?.[move.from.x] || !zobristTable[move.to.y]?.[move.to.x]) {
            console.error("Local Engine: Zobrist re-init failed for unmakeMoveLocal.");
        }
    }

    if (zobristTable[move.to.y]?.[move.to.x]?.get(`${piece.type}_${piece.color}`)) {
        zobristKey ^= zobristTable[move.to.y][move.to.x].get(`${piece.type}_${piece.color}`);
    }

    board[move.from.y][move.from.x] = piece;
    board[move.to.y][move.to.x] = capturedPiece;

    if (zobristTable[move.from.y]?.[move.from.x]?.get(`${piece.type}_${piece.color}`)) {
        zobristKey ^= zobristTable[move.from.y][move.from.x].get(`${piece.type}_${piece.color}`);
    }
    if (capturedPiece && zobristTable[move.to.y]?.[move.to.x]?.get(`${capturedPiece.type}_${capturedPiece.color}`)) {
        zobristKey ^= zobristTable[move.to.y][move.to.x].get(`${capturedPiece.type}_${capturedPiece.color}`);
    }
};

function evaluateBoardLocal(board, colorToMove) {
    if (!pieceTablesInitialized) initializePieceTables();
    let blackScore = 0;
    let redScore = 0;

    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const piece = board[y][x];
            if (piece) {
                let baseScore = pieceBaseScores[piece.type] || 0;
                let posScore = 0;
                const pstTableForPiece = piecePositionScores[piece.type];
                if (pstTableForPiece) {
                    const pstY = piece.color === PIECE_COLOR.RED ? (9 - y) : y;
                    const pstX = piece.color === PIECE_COLOR.RED ? (8 - x) : x; // 假设PST是从右到左为红方，从左到右为黑方
                    if (pstTableForPiece[pstY] && pstTableForPiece[pstY][pstX] !== undefined) {
                        posScore = pstTableForPiece[pstY][pstX];
                    }
                }
                const totalScore = baseScore + posScore;
                if (piece.color === PIECE_COLOR.BLACK) blackScore += totalScore;
                else redScore += totalScore;
            }
        }
    }
    if (isKingInCheck(board, PIECE_COLOR.BLACK)) blackScore -= 50;
    if (isKingInCheck(board, PIECE_COLOR.RED)) redScore -= 50;

    const rawScore = redScore - blackScore; // 红方正，黑方负
    return colorToMove === PIECE_COLOR.RED ? rawScore : -rawScore;
};

function getMoveScoreLocal(board, move, ply, hashMove) {
    let score = 0;
    if (hashMove && move.from.x === hashMove.from.x && move.from.y === hashMove.from.y && move.to.x === hashMove.to.x && move.to.y === hashMove.to.y) {
        return 200000; // TT 推荐走法
    }
    const capturedPiece = board[move.to.y][move.to.x];
    if (capturedPiece) {
        const attacker = board[move.from.y][move.from.x];
        if (attacker) {
            const victimScore = pieceBaseScores[capturedPiece.type] || 0;
            const attackerScore = pieceBaseScores[attacker.type] || 0;
            score += 10000 + (victimScore * 10) - attackerScore; // MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
        }
    }
    if (ply < killerMoves.length && killerMoves[ply]) {
        if (killerMoves[ply][0] && killerMoves[ply][0].from.x === move.from.x && killerMoves[ply][0].from.y === move.from.y && killerMoves[ply][0].to.x === move.to.x && killerMoves[ply][0].to.y === move.to.y) {
            score += 9000; // Killer move 1
        } else if (killerMoves[ply][1] && killerMoves[ply][1].from.x === move.from.x && killerMoves[ply][1].from.y === move.from.y && killerMoves[ply][1].to.x === move.to.x && killerMoves[ply][1].to.y === move.to.y) {
            score += 8000; // Killer move 2
        }
    }
    if (move.from.y >= 0 && move.from.y < 10 && move.from.x >= 0 && move.from.x < 9 &&
        move.to.y >= 0 && move.to.y < 10 && move.to.x >= 0 && move.to.x < 9) {
       score += historyTable[move.from.y][move.from.x][move.to.y][move.to.x];
    }
    return score;
};

function orderMovesLocal(board, moves, ply, hashMove, quiescenceMode = false) {
    moves.forEach(move => {
        move.score = getMoveScoreLocal(board, move, ply, hashMove);
        if (quiescenceMode) {
            const capturedPieceOnBoard = board[move.to.y][move.to.x];
            const movingPiece = board[move.from.y][move.from.x];
            if (!movingPiece) { move.score = -INFINITY -1; return; }

            const opponentColor = (movingPiece.color === PIECE_COLOR.RED ? PIECE_COLOR.BLACK : PIECE_COLOR.RED);
            
            const tempBoard = board.map(r => r.map(p => p ? {...p} : null));
            const pieceToMove = tempBoard[move.from.y][move.from.x];
            if (pieceToMove) {
                tempBoard[move.to.y][move.to.x] = pieceToMove;
                tempBoard[move.from.y][move.from.x] = null;
                const isCheck = isKingInCheck(tempBoard, opponentColor);

                if (!capturedPieceOnBoard && !isCheck) { // 静默搜索只考虑吃子或将军
                    move.score = -INFINITY -1;
                }
            } else {
                move.score = -INFINITY -1;
            }
        }
    });
    moves.sort((a, b) => b.score - a.score);
};

// 4. 搜索算法
function quiescenceSearchLocal(board, alpha, beta, color, ply, rootStartTime) {
    nodesSearched++;
    if (Date.now() - rootStartTime > LOCAL_MAX_THINKING_TIME) throw new Error("LocalSearchTimeout");
    if (ply > LOCAL_SEARCH_DEPTH + 5 + 3) return evaluateBoardLocal(board, color);

    let standPat = evaluateBoardLocal(board, color);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    let moves = generateLegalMoves(board, color);
    orderMovesLocal(board, moves, ply, null, true); // true for quiescence mode

    for (const move of moves) {
        if (move.score <= -INFINITY) continue; // 被 orderMovesLocal 标记为不搜索的（非吃子非将军）
        
        const opponentColor = (color === PIECE_COLOR.RED ? PIECE_COLOR.BLACK : PIECE_COLOR.RED);
        const actualCapturedPiece = makeMoveLocal(board, move);
        const score = -quiescenceSearchLocal(board, -beta, -alpha, opponentColor, ply + 1, rootStartTime);
        unmakeMoveLocal(board, move, actualCapturedPiece);

        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
};

function alphaBetaLocal(board, depth, alpha, beta, color, ply, rootStartTime) {
    nodesSearched++;
    if (ply > 0 && (Date.now() - rootStartTime > LOCAL_MAX_THINKING_TIME)) throw new Error("LocalSearchTimeout");
    
    if (ply >= killerMoves.length -1 ) { // 避免 killerMoves 数组越界
        return evaluateBoardLocal(board, color);
    }
    if (ply > LOCAL_SEARCH_DEPTH + 5 ) { // 最大搜索层数限制（包括扩展）
         return evaluateBoardLocal(board, color);
    }

    const originalAlpha = alpha;
    const ttKey = zobristKey;
    const ttEntry = transpositionTable.get(ttKey);

    if (ttEntry && ttEntry.depth >= depth && ply > 0) { // ply > 0 确保根节点不直接用TT
        if (ttEntry.flag === TT_FLAG.EXACT) return ttEntry.score;
        if (ttEntry.flag === TT_FLAG.LOWER_BOUND) alpha = Math.max(alpha, ttEntry.score);
        else if (ttEntry.flag === TT_FLAG.UPPER_BOUND) beta = Math.min(beta, ttEntry.score);
        if (alpha >= beta) return ttEntry.score;
    }

    let moves = generateLegalMoves(board, color);
    if (moves.length === 0) {
        return isKingInCheck(board, color) ? (-MATE_SCORE + ply) : 0; // 将死或无子可走（逼和）
    }
    if (depth <= 0) {
        return quiescenceSearchLocal(board, alpha, beta, color, ply, rootStartTime);
    }
    
    orderMovesLocal(board, moves, ply, ttEntry ? ttEntry.bestMove : null);
    
    let bestMoveThisNode = null;
    let bestScore = -INFINITY;

    for (const move of moves) {
        const capturedPiece = makeMoveLocal(board, move);
        let score;
        let newDepth = depth - 1;
        const opponentColor = color === PIECE_COLOR.RED ? PIECE_COLOR.BLACK : PIECE_COLOR.RED;
        
        if (isKingInCheck(board, opponentColor)) { // 将军延伸
            newDepth += 1;
        }

        score = -alphaBetaLocal(board, newDepth, -beta, -alpha, opponentColor, ply + 1, rootStartTime);
        unmakeMoveLocal(board, move, capturedPiece);

        if (score > bestScore) {
            bestScore = score;
            bestMoveThisNode = move;
        }
        alpha = Math.max(alpha, bestScore);
        
        if (alpha >= beta) { // Beta cutoff
            if (!capturedPiece && ply < killerMoves.length) { // 非吃子走法才加入 Killer
               if (!killerMoves[ply][0] ||
                   !(killerMoves[ply][0].from.x === move.from.x && killerMoves[ply][0].from.y === move.from.y &&
                     killerMoves[ply][0].to.x === move.to.x && killerMoves[ply][0].to.y === move.to.y)) {
                   killerMoves[ply][1] = killerMoves[ply][0];
                   killerMoves[ply][0] = move;
               }
            }
            if (bestMoveThisNode && 
                bestMoveThisNode.from.y >=0 && bestMoveThisNode.from.x >=0 && bestMoveThisNode.to.y >=0 && bestMoveThisNode.to.x >=0 &&
                bestMoveThisNode.from.y < 10 && bestMoveThisNode.from.x < 9 && bestMoveThisNode.to.y < 10 && bestMoveThisNode.to.x < 9) {
                 historyTable[bestMoveThisNode.from.y][bestMoveThisNode.from.x][bestMoveThisNode.to.y][bestMoveThisNode.to.x] += depth * depth;
            }
            break;
        }
    }
    
    let flag = TT_FLAG.EXACT;
    if (bestScore <= originalAlpha) flag = TT_FLAG.UPPER_BOUND;
    else if (bestScore >= beta) flag = TT_FLAG.LOWER_BOUND;

    const existingTTEntry = transpositionTable.get(ttKey);
    if (!existingTTEntry || depth >= existingTTEntry.depth || (flag === TT_FLAG.EXACT && existingTTEntry.flag !== TT_FLAG.EXACT) ) {
        transpositionTable.set(ttKey, { score: bestScore, depth: depth, flag: flag, bestMove: bestMoveThisNode });
    }
    return bestScore;
};

// 5. 主搜索函数
export async function getLocalEngineMove(board, currentColor, _overallStartTimeIgnored) { // _overallStartTimeIgnored 因为现在超时在循环内部处理
    console.log("Local Engine: Starting search.");
    if (!pieceTablesInitialized) initializePieceTables();
    if (!zobristInitialized) initZobristForLocalEngine();

    transpositionTable.clear();
    killerMoves.forEach(level => { level[0] = null; level[1] = null; });
    historyTable.forEach(row => row.forEach(col => col.forEach(sqRow => sqRow.fill(0))));
    nodesSearched = 0;

    const searchBoard = board.map(row => row.map(piece => piece ? {...piece} : null));
    zobristKey = computeZobristKeyForLocalEngine(searchBoard);
    
    const legalMovesAtRoot = generateLegalMoves(searchBoard, currentColor);
    if (legalMovesAtRoot.length === 0) {
        console.log("Local Engine: No legal moves at root.");
        return null;
    }
    
    let bestMoveFromCompletedSearch = null;
    let bestScoreFromCompletedSearch = -INFINITY;
    let lastFullyCompletedDepth = 0;
    const localEngineRunStartTime = Date.now();

    try {
        for (let currentDepth = 1; currentDepth <= LOCAL_SEARCH_DEPTH; currentDepth++) {
            if (currentDepth > 1 && (Date.now() - localEngineRunStartTime > LOCAL_MAX_THINKING_TIME)) {
                console.log(`Local Engine: Time limit (${LOCAL_MAX_THINKING_TIME}ms) reached before depth ${currentDepth}. Best from depth ${lastFullyCompletedDepth}.`);
                break;
            }
            // console.log(`Local Engine: Iterative deepening, depth ${currentDepth}, Zobrist key: ${zobristKey}`);
            const score = alphaBetaLocal(searchBoard, currentDepth, -INFINITY, INFINITY, currentColor, 0, localEngineRunStartTime);
            
            const rootEntry = transpositionTable.get(zobristKey);

            if (rootEntry && rootEntry.bestMove && rootEntry.bestMove.from && rootEntry.bestMove.to) {
                const isTTMoveLegal = legalMovesAtRoot.some(
                    lm => lm.from.x === rootEntry.bestMove.from.x && lm.from.y === rootEntry.bestMove.from.y &&
                          lm.to.x === rootEntry.bestMove.to.x && lm.to.y === rootEntry.bestMove.to.y
                );
                if (isTTMoveLegal) {
                    bestMoveFromCompletedSearch = rootEntry.bestMove;
                    bestScoreFromCompletedSearch = score;
                    lastFullyCompletedDepth = currentDepth;
                } else {
                     console.warn(`Local Engine: TT Best move for depth ${currentDepth} was illegal. Move: ${JSON.stringify(rootEntry.bestMove)}`);
                     if (!bestMoveFromCompletedSearch && legalMovesAtRoot.length > 0) {
                        bestMoveFromCompletedSearch = legalMovesAtRoot[0]; // 备用
                     }
                }
            } else if (currentDepth === 1 && !bestMoveFromCompletedSearch && legalMovesAtRoot.length > 0) {
                bestMoveFromCompletedSearch = legalMovesAtRoot[0]; // 深度1后TT无最佳走法，使用第一个合法走法
                bestScoreFromCompletedSearch = score;
                lastFullyCompletedDepth = currentDepth;
                console.warn("Local Engine: TT had no best move after depth 1 search, used first legal move.");
            }
            if (!bestMoveFromCompletedSearch && legalMovesAtRoot.length > 0) { // 确保有合法走法时总有一个最佳走法
                bestMoveFromCompletedSearch = legalMovesAtRoot[0];
                console.warn(`Local Engine: bestMoveFromCompletedSearch was null after depth ${currentDepth}, falling back to first legal move.`);
            }
        }
    } catch (e) {
        if (e.message === "LocalSearchTimeout") {
            console.log(`Local Engine: Search for depth ${lastFullyCompletedDepth + 1} cut short by time limit. Using results from depth ${lastFullyCompletedDepth}.`);
        } else {
            console.error("Local Engine: Error during iterative deepening search:", e);
            if (!bestMoveFromCompletedSearch && legalMovesAtRoot.length > 0) {
                bestMoveFromCompletedSearch = legalMovesAtRoot[0];
                console.warn("Local Engine: Using first legal move due to search error.");
            }
        }
    }
    
    if (!bestMoveFromCompletedSearch && legalMovesAtRoot.length > 0) {
        bestMoveFromCompletedSearch = legalMovesAtRoot[0];
        console.warn("Local Engine: No move found from iterative deepening. Using first legal move as fallback.");
    }

    const localTime = Date.now() - localEngineRunStartTime;
    if (bestMoveFromCompletedSearch) {
        console.log(
            `Local Engine: Found move from (${bestMoveFromCompletedSearch.from.x},${bestMoveFromCompletedSearch.from.y}) to (${bestMoveFromCompletedSearch.to.x},${bestMoveFromCompletedSearch.to.y}). ` +
            `Score: ${bestScoreFromCompletedSearch}. Depth: ${lastFullyCompletedDepth}. Nodes: ${nodesSearched}. TT Size: ${transpositionTable.size}. Time: ${localTime}ms`
        );
    } else {
        console.log(`Local Engine: No move found. Time: ${localTime}ms. Nodes: ${nodesSearched}. TT Size: ${transpositionTable.size}.`);
    }
    return bestMoveFromCompletedSearch;
}


// --- END OF FILE localEngine.js ---