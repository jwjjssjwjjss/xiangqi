// --- START OF FILE localEngine.js ---

import { PIECE_COLOR, PIECE_TYPES, generateLegalMoves, isKingInCheck } from './gameLogic'; // 假设 gameLogic.js 在同一目录

// 1. 评估参数 (Evaluation Parameters)
const MATE_SCORE = 100000;
const INFINITY = 1000000;
const LOCAL_SEARCH_DEPTH = 7;
const LOCAL_MAX_THINKING_TIME = 1000; // 毫秒
const DRAW_SCORE = 0; // 和棋分数

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
let zobristKey; // Current Zobrist key for the board being searched
const transpositionTable = new Map();
const TT_FLAG = { EXACT: 0, LOWER_BOUND: 1, UPPER_BOUND: 2 };
const killerMoves = Array(LOCAL_SEARCH_DEPTH + 6).fill(null).map(() => [null, null]); // 深度 + 额外层级给静默搜索
const historyTable = Array(10).fill(null).map(() => Array(9).fill(null).map(() => Array(10).fill(null).map(() => Array(9).fill(0))));
let nodesSearched = 0;
let zobristInitialized = false;

// Export for ChessBoard.js to use
export function initZobristForLocalEngine() {
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

// Export for ChessBoard.js to use
export function computeZobristKeyForLocalEngine(board) {
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
                    const pstX = piece.color === PIECE_COLOR.RED ? (8 - x) : x; 
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

    const rawScore = redScore - blackScore;
    return colorToMove === PIECE_COLOR.RED ? rawScore : -rawScore;
};

function getMoveScoreLocal(board, move, ply, hashMove) {
    let score = 0;
    if (hashMove && move.from.x === hashMove.from.x && move.from.y === hashMove.from.y && move.to.x === hashMove.to.x && move.to.y === hashMove.to.y) {
        return 200000; 
    }
    const capturedPiece = board[move.to.y][move.to.x];
    if (capturedPiece) {
        const attacker = board[move.from.y][move.from.x];
        if (attacker) {
            const victimScore = pieceBaseScores[capturedPiece.type] || 0;
            const attackerScore = pieceBaseScores[attacker.type] || 0;
            score += 10000 + (victimScore * 10) - attackerScore; 
        }
    }
    if (ply < killerMoves.length && killerMoves[ply]) {
        if (killerMoves[ply][0] && killerMoves[ply][0].from.x === move.from.x && killerMoves[ply][0].from.y === move.from.y && killerMoves[ply][0].to.x === move.to.x && killerMoves[ply][0].to.y === move.to.y) {
            score += 9000;
        } else if (killerMoves[ply][1] && killerMoves[ply][1].from.x === move.from.x && killerMoves[ply][1].from.y === move.from.y && killerMoves[ply][1].to.x === move.to.x && killerMoves[ply][1].to.y === move.to.y) {
            score += 8000;
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

                if (!capturedPieceOnBoard && !isCheck) { 
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
function quiescenceSearchLocal(board, alpha, beta, color, ply, rootStartTime, currentRepetitionHistory) {
    nodesSearched++;
    if (Date.now() - rootStartTime > LOCAL_MAX_THINKING_TIME) throw new Error("LocalSearchTimeout");
    if (ply > LOCAL_SEARCH_DEPTH + 5 + 3) return evaluateBoardLocal(board, color);

    // 检查当前局面是否因5次重复而为和棋
    if ((currentRepetitionHistory.get(zobristKey) || 0) >= 5) {
        return DRAW_SCORE;
    }

    let standPat = evaluateBoardLocal(board, color);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    let moves = generateLegalMoves(board, color);
    orderMovesLocal(board, moves, ply, null, true); 

    for (const move of moves) {
        if (move.score <= -INFINITY) continue; 
        
        const opponentColor = (color === PIECE_COLOR.RED ? PIECE_COLOR.BLACK : PIECE_COLOR.RED);
        const actualCapturedPiece = makeMoveLocal(board, move); // zobristKey updated
        const keyAfterMove = zobristKey;
        const oldCountForThisState = currentRepetitionHistory.get(keyAfterMove) || 0;
        currentRepetitionHistory.set(keyAfterMove, oldCountForThisState + 1);

        let score;
        if (currentRepetitionHistory.get(keyAfterMove) >= 5) {
            score = DRAW_SCORE;
        } else {
            score = -quiescenceSearchLocal(board, -beta, -alpha, opponentColor, ply + 1, rootStartTime, currentRepetitionHistory);
        }
        
        unmakeMoveLocal(board, move, actualCapturedPiece); // zobristKey reverted
        // 恢复 repetition count for the state we are leaving
        if (oldCountForThisState === 0) {
            currentRepetitionHistory.delete(keyAfterMove);
        } else {
            currentRepetitionHistory.set(keyAfterMove, oldCountForThisState);
        }


        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
};

function alphaBetaLocal(board, depth, alpha, beta, color, ply, rootStartTime, currentRepetitionHistory) {
    nodesSearched++;
    if (ply > 0 && (Date.now() - rootStartTime > LOCAL_MAX_THINKING_TIME)) throw new Error("LocalSearchTimeout");
    
    // 检查当前局面是否因5次重复而为和棋
    if ((currentRepetitionHistory.get(zobristKey) || 0) >= 5) {
        return DRAW_SCORE;
    }

    if (ply >= killerMoves.length -1 ) { 
        return evaluateBoardLocal(board, color);
    }
    if (ply > LOCAL_SEARCH_DEPTH + 5 ) { 
         return evaluateBoardLocal(board, color);
    }

    const originalAlpha = alpha;
    const ttKey = zobristKey; // Use module-level zobristKey
    const ttEntry = transpositionTable.get(ttKey);

    if (ttEntry && ttEntry.depth >= depth && ply > 0) { 
        if (ttEntry.flag === TT_FLAG.EXACT) return ttEntry.score;
        if (ttEntry.flag === TT_FLAG.LOWER_BOUND) alpha = Math.max(alpha, ttEntry.score);
        else if (ttEntry.flag === TT_FLAG.UPPER_BOUND) beta = Math.min(beta, ttEntry.score);
        if (alpha >= beta) return ttEntry.score;
    }

    let moves = generateLegalMoves(board, color);
    if (moves.length === 0) {
        return isKingInCheck(board, color) ? (-MATE_SCORE + ply) : DRAW_SCORE; // 将死或无子可走（逼和）
    }
    if (depth <= 0) {
        return quiescenceSearchLocal(board, alpha, beta, color, ply, rootStartTime, currentRepetitionHistory);
    }
    
    orderMovesLocal(board, moves, ply, ttEntry ? ttEntry.bestMove : null);
    
    let bestMoveThisNode = null;
    let bestScore = -INFINITY;

    for (const move of moves) {
        const capturedPiece = makeMoveLocal(board, move); // zobristKey updated
        const keyAfterMove = zobristKey;
        const oldCountForThisState = currentRepetitionHistory.get(keyAfterMove) || 0;
        currentRepetitionHistory.set(keyAfterMove, oldCountForThisState + 1);
        
        let score;
        let newDepth = depth - 1;
        const opponentColor = color === PIECE_COLOR.RED ? PIECE_COLOR.BLACK : PIECE_COLOR.RED;
        
        if (isKingInCheck(board, opponentColor)) { 
            newDepth += 1;
        }

        if (currentRepetitionHistory.get(keyAfterMove) >= 5) {
            score = DRAW_SCORE; // This move leads to a 5-fold repetition draw
        } else {
            score = -alphaBetaLocal(board, newDepth, -beta, -alpha, opponentColor, ply + 1, rootStartTime, currentRepetitionHistory);
        }
        
        unmakeMoveLocal(board, move, capturedPiece); // zobristKey reverted
        // 恢复 repetition count for the state we are leaving
        if (oldCountForThisState === 0) {
            currentRepetitionHistory.delete(keyAfterMove);
        } else {
            currentRepetitionHistory.set(keyAfterMove, oldCountForThisState);
        }


        if (score > bestScore) {
            bestScore = score;
            bestMoveThisNode = move;
        }
        alpha = Math.max(alpha, bestScore);
        
        if (alpha >= beta) { 
            if (!capturedPiece && ply < killerMoves.length) { 
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
        // Do not store score from repetition draw if it's not EXACT, to avoid polluting TT with draw scores
        // unless it's a proven draw. But for simplicity, we store it.
        // If bestScore is DRAW_SCORE because of repetition, that's the accurate score for this node.
        transpositionTable.set(ttKey, { score: bestScore, depth: depth, flag: flag, bestMove: bestMoveThisNode });
    }
    return bestScore;
};

// 5. 主搜索函数
export async function getLocalEngineMove(board, currentColor, _overallStartTimeIgnored, gameRepetitionHistory) { 
    console.log("Local Engine: Starting search.");
    if (!pieceTablesInitialized) initializePieceTables();
    if (!zobristInitialized) initZobristForLocalEngine();

    transpositionTable.clear();
    killerMoves.forEach(level => { level[0] = null; level[1] = null; });
    historyTable.forEach(row => row.forEach(col => col.forEach(sqRow => sqRow.fill(0))));
    nodesSearched = 0;

    const searchBoard = board.map(row => row.map(piece => piece ? {...piece} : null));
    zobristKey = computeZobristKeyForLocalEngine(searchBoard); // Set initial zobristKey for the search
    
    // The gameRepetitionHistory reflects counts *before* this turn.
    // The current zobristKey's count in gameRepetitionHistory is for the state *we are searching from*.
    const currentSearchRepetitionHistory = new Map(gameRepetitionHistory);
    // Ensure the current board state (root of search) is in this history for the engine.
    // ChessBoard.js should already manage this, but as a safeguard:
    if (!currentSearchRepetitionHistory.has(zobristKey)) {
        console.warn("Local Engine: Root Zobrist key not in provided repetition history. Initializing to 1 for search.");
        currentSearchRepetitionHistory.set(zobristKey, 1);
    }
    // If the root position itself is a 5-fold draw, ChessBoard.js should have ended the game.
    // If engine is called, it means game is ongoing.
    
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
            
            const score = alphaBetaLocal(searchBoard, currentDepth, -INFINITY, INFINITY, currentColor, 0, localEngineRunStartTime, new Map(currentSearchRepetitionHistory) /* Pass a fresh copy for each iteration */);
            
            const rootEntry = transpositionTable.get(zobristKey); // TT entry for the root board state

            if (rootEntry && rootEntry.bestMove && rootEntry.bestMove.from && rootEntry.bestMove.to) {
                const isTTMoveLegal = legalMovesAtRoot.some(
                    lm => lm.from.x === rootEntry.bestMove.from.x && lm.from.y === rootEntry.bestMove.from.y &&
                          lm.to.x === rootEntry.bestMove.to.x && lm.to.y === rootEntry.bestMove.to.y
                );
                if (isTTMoveLegal) {
                    bestMoveFromCompletedSearch = rootEntry.bestMove;
                    bestScoreFromCompletedSearch = score; // Use the score from alphaBeta call, not TT's score directly for root
                    lastFullyCompletedDepth = currentDepth;
                } else {
                     console.warn(`Local Engine: TT Best move for depth ${currentDepth} was illegal. Move: ${JSON.stringify(rootEntry.bestMove)}`);
                     if (!bestMoveFromCompletedSearch && legalMovesAtRoot.length > 0) {
                        bestMoveFromCompletedSearch = legalMovesAtRoot[0]; 
                     }
                }
            } else if (currentDepth === 1 && !bestMoveFromCompletedSearch && legalMovesAtRoot.length > 0) {
                // If TT has no best move after depth 1 (e.g., all moves lead to immediate draw by repetition)
                // or if alphaBeta directly returned a score like DRAW_SCORE without a specific best move via TT.
                // We need a move. If transposition table does not yield one, find the best based on scores
                // or pick first legal if all scores are identical (e.g. all draws)
                // This part is tricky if alphaBeta returns DRAW_SCORE and TT is not populated with a move.
                // For now, if no bestMove from TT, but alphaBeta returned a score, and we need a move,
                // we might need to iterate moves at root or rely on fallback.
                // The current structure relies on TT to store the bestMove.
                // If all moves lead to draw, alphaBeta might find one, but if it was pruned, TT might not have it.
                // A robust way is to iterate root moves in getLocalEngineMove, but that's a larger refactor.
                // For now, if TT has no move, we'll fall back.
                 if (!bestMoveFromCompletedSearch && legalMovesAtRoot.length > 0) {
                    bestMoveFromCompletedSearch = legalMovesAtRoot[0];
                    bestScoreFromCompletedSearch = score; // Set score from depth 1
                    lastFullyCompletedDepth = currentDepth;
                    console.warn("Local Engine: TT had no best move after depth 1 search, used first legal move if available.");
                }
            }

            if (!bestMoveFromCompletedSearch && legalMovesAtRoot.length > 0) { 
                bestMoveFromCompletedSearch = legalMovesAtRoot[0];
                bestScoreFromCompletedSearch = score; // Ensure score is updated
                console.warn(`Local Engine: bestMoveFromCompletedSearch was null after depth ${currentDepth}, falling back to first legal move.`);
            }
        }
    } catch (e) {
        if (e.message === "LocalSearchTimeout") {
            console.log(`Local Engine: Search for depth ${lastFullyCompletedDepth + 1} cut short by time limit. Using results from depth ${lastFullyCompletedDepth}.`);
        } else {
            console.error("Local Engine: Error during iterative deepening search:", e);
        }
        if (!bestMoveFromCompletedSearch && legalMovesAtRoot.length > 0) { // Fallback in case of error
            bestMoveFromCompletedSearch = legalMovesAtRoot[0];
            console.warn("Local Engine: Using first legal move due to search error or timeout without a move.");
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