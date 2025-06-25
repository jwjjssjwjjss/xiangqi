// --- START OF FILE aiWorker.js ---
/* eslint-disable no-restricted-globals */

import { PIECE_COLOR, PIECE_TYPES, generateLegalMoves } from './gameLogic.js'; // 假设 gameLogic.js 在同一目录
import { getCloudMove, boardToFen } from './cloudMoveFetcher.js';
import { getLocalEngineMove, initializePieceTables } from './localEngine.js';

const CLOUD_API_TIMEOUT_EARLY_GAME = 2000; // 开局云端超时时间

// -------------------------------------------------------------------
// 5. Main AI Decision Logic (findBestMove)
// -------------------------------------------------------------------
async function findBestMove(board, currentColor, plyCount) {
    const overallStartTime = Date.now();
    const fen = boardToFen(board, currentColor);
    console.log(`AI Worker: Finding best move for FEN: ${fen}, Ply: ${plyCount}`);

    let finalMove = null;
    let moveSource = "None";
    
    const boardCopyForValidation = board.map(row => row.map(p => p ? {...p} : null));

    const EARLY_GAME_PLY_THRESHOLD = 20;

    if (plyCount < EARLY_GAME_PLY_THRESHOLD) {
        console.log(`AI Worker: Ply ${plyCount} < ${EARLY_GAME_PLY_THRESHOLD}. Prioritizing Cloud move with timeout ${CLOUD_API_TIMEOUT_EARLY_GAME}ms.`);
        try {
            const cloudMove = await getCloudMove(fen, boardCopyForValidation, currentColor, CLOUD_API_TIMEOUT_EARLY_GAME);
            if (cloudMove) {
                finalMove = cloudMove;
                moveSource = "Cloud (Early Game)";
                console.log("AI Worker: Using Cloud move (Early Game).");
            } else {
                console.warn(`AI Worker: Cloud move failed or not found in early game (Ply ${plyCount}). Fallback will be attempted.`);
            }
        } catch (error) {
            console.error(`AI Worker: Error during getCloudMove in early game (Ply ${plyCount}):`, error);
        }
    } else {
        console.log(`AI Worker: Ply ${plyCount} >= ${EARLY_GAME_PLY_THRESHOLD}. Running local engine and attempting cloud concurrently.`);
        
        // 注意：cloudMoveFetcher.js 中的 CLOUD_API_TIMEOUT 是默认值，这里可以按需覆盖
        const defaultCloudTimeout = 800; // 与 cloudMoveFetcher.js 中 CLOUD_API_TIMEOUT 一致

        const cloudMovePromise = getCloudMove(fen, boardCopyForValidation, currentColor, defaultCloudTimeout)
            .then(move => ({ source: 'cloud', move: move, error: null }))
            .catch(error => ({ source: 'cloud', move: null, error: error }));

        const localEngineMovePromise = getLocalEngineMove(board, currentColor, overallStartTime) // overallStartTime 仅供参考，超时在 localEngine 内部管理
            .then(move => ({ source: 'local', move: move, error: null }))
            .catch(error => {
                console.error('AI Worker: Local engine promise rejected:', error);
                return { source: 'local', move: null, error: error };
            });

        const localResult = await localEngineMovePromise;
        
        const GRACE_PERIOD_FOR_CLOUD_MS = 50;
        const cloudResultOutcome = await Promise.race([
            cloudMovePromise,
            new Promise(resolve => setTimeout(() => resolve({ source: 'timeout_grace_period', move: null, error: new Error("Cloud grace period expired") }), GRACE_PERIOD_FOR_CLOUD_MS))
        ]);

        if (cloudResultOutcome.source === 'cloud' && cloudResultOutcome.move) {
            console.log("AI Worker: Cloud responded within grace period with a valid move. Prioritizing Cloud.");
            finalMove = cloudResultOutcome.move;
            moveSource = "Cloud (Mid/Late Game)";
        } else {
            if (cloudResultOutcome.source === 'cloud' && !cloudResultOutcome.move) {
                 console.log("AI Worker: Cloud responded within grace period but had no valid move or an error. Using Local.");
            } else if (cloudResultOutcome.source === 'timeout_grace_period') {
                 console.log("AI Worker: Cloud did not respond within grace period. Using Local.");
            }
            
            if (localResult.move) {
                finalMove = localResult.move;
                moveSource = "Local (Cloud Slow/Failed/None or Local Preferred)";
            } else {
                finalMove = null;
                moveSource = "None (Local Failed & Cloud Slow/Failed/None)";
                if (cloudResultOutcome.source === 'cloud' && cloudResultOutcome.move) { // 如果云端迟到但有结果，且本地失败
                    finalMove = cloudResultOutcome.move;
                    moveSource = "Cloud (Mid/Late Game - Late but used as Local failed)";
                }
            }
            
            if (cloudResultOutcome.source === 'timeout_grace_period') {
                cloudMovePromise.then(finalCloudResult => {
                    if (finalCloudResult.move) console.log("AI Worker: Cloud (late) responded with move, cached (if valid).", finalCloudResult.move);
                }).catch(()=>{/* 错误已由 getCloudMove 或其包装器记录 */});
            }
        }
    }
    
    if (finalMove) {
        const finalValidationBoard = board.map(row => row.map(p => p ? {...p} : null));
        const legalMovesForFinalCheck = generateLegalMoves(finalValidationBoard, currentColor);
        const isFinalMoveLegit = legalMovesForFinalCheck.some(
            lm => lm.from.x === finalMove.from.x && lm.from.y === finalMove.from.y &&
                  lm.to.x === finalMove.to.x && lm.to.y === finalMove.to.y
        );

        if (!isFinalMoveLegit) {
            console.error(`AI Worker: CRITICAL - Chosen finalMove from ${moveSource} is ILLEGAL! Move: ${JSON.stringify(finalMove)}. Attempting fallback.`);
            finalMove = null;
            moveSource += " (Illegal, Fallback!)";
        } else {
             preFetchNextMoves(board, currentColor, finalMove, plyCount + 1);
        }
    }
    
    if (!finalMove) {
        console.warn(`AI Worker: No valid move from primary sources (Ply ${plyCount}, Prev Source: ${moveSource}). Fallback to first legal move.`);
        const fallbackBoard = board.map(row => row.map(p => p ? {...p} : null));
        const legalMoves = generateLegalMoves(fallbackBoard, currentColor);
        if (legalMoves.length > 0) {
            finalMove = legalMoves[0];
            moveSource = moveSource.includes("Fallback!") ? moveSource : "Fallback (First Legal)";
            console.log("AI Worker: Using first legal move as ultimate fallback:", finalMove);
            preFetchNextMoves(board, currentColor, finalMove, plyCount + 1);
        } else {
            console.error(`AI Worker: CRITICAL - No legal moves available for fallback (Ply ${plyCount}). No move possible.`);
            moveSource = "None (No Legal Moves)";
        }
    }

    const totalTime = Date.now() - overallStartTime;
    let moveStr = finalMove ? `from (${finalMove.from.x},${finalMove.from.y}) to (${finalMove.to.x},${finalMove.to.y})` : 'None';
    console.log(`AI Worker: Ply: ${plyCount}. Final Move: ${moveStr}. Source: ${moveSource}. Total Time: ${totalTime}ms.`);
    return finalMove;
}

// -------------------------------------------------------------------
// 6. Pre-fetching Logic
// -------------------------------------------------------------------
async function preFetchNextMoves(originalBoard, aiColor, aiBestMove, currentPlyAfterAIMove) {
    const boardAfterAIMove = originalBoard.map(row => row.map(piece => piece ? { ...piece } : null));
    const movingPieceForAI = boardAfterAIMove[aiBestMove.from.y]?.[aiBestMove.from.x];
    
    if (!movingPieceForAI) {
        console.error("AI Pre-fetch: No piece at AI's 'from' position for simulation.", aiBestMove.from);
        return;
    }
    boardAfterAIMove[aiBestMove.to.y][aiBestMove.to.x] = { ...movingPieceForAI };
    boardAfterAIMove[aiBestMove.from.y][aiBestMove.from.x] = null;

    const opponentColor = (aiColor === PIECE_COLOR.RED ? PIECE_COLOR.BLACK : PIECE_COLOR.RED);
    const opponentLegalMoves = generateLegalMoves(boardAfterAIMove, opponentColor);

    if (opponentLegalMoves.length === 0) return;

    const MAX_PREFETCH_MOVES = 3;
    const movesToPrefetch = opponentLegalMoves.slice(0, MAX_PREFETCH_MOVES);
    const defaultCloudTimeoutForPrefetch = 800; // 与 cloudMoveFetcher.js 中 CLOUD_API_TIMEOUT 一致

    movesToPrefetch.forEach(opponentMove => {
        const boardAfterOpponentMove = boardAfterAIMove.map(row => row.map(piece => piece ? { ...piece } : null));
        const movingPieceForOpponent = boardAfterOpponentMove[opponentMove.from.y]?.[opponentMove.from.x];
         if (!movingPieceForOpponent) {
            console.error("AI Pre-fetch: No piece at opponent's 'from' for simulation.", opponentMove.from);
            return;
        }
        boardAfterOpponentMove[opponentMove.to.y][opponentMove.to.x] = { ...movingPieceForOpponent };
        boardAfterOpponentMove[opponentMove.from.y][opponentMove.from.x] = null;
        
        const nextFenForAI = boardToFen(boardAfterOpponentMove, aiColor);

        // cloudMoveFetcher.js 内部会检查缓存
        // console.log(`AI Pre-fetch: Querying for FEN: ${nextFenForAI}`);
        getCloudMove(nextFenForAI, boardAfterOpponentMove, aiColor, defaultCloudTimeoutForPrefetch)
            .then(move => {
                // if (move) { console.log(`AI Pre-fetch: Successfully fetched and cached move for FEN ${nextFenForAI}`); }
                // else { console.warn(`AI Pre-fetch: Failed to get/validate move for FEN ${nextFenForAI}`); }
            })
            .catch(e => { /* console.warn(`AI Pre-fetch: Error in background fetch for ${nextFenForAI}: ${e.message}`); */ });
    });
}

// -------------------------------------------------------------------
// Worker Message Handler
// -------------------------------------------------------------------
let systemInitialized = false;

self.onmessage = async (event) => {
    const { board, currentColor, plyCount } = event.data;

    if (board === undefined || currentColor === undefined || plyCount === undefined) {
        console.error("AI Worker: Invalid message. Missing board, currentColor, or plyCount.", event.data);
        self.postMessage({ bestMove: null, error: "Invalid input to worker." });
        return;
    }

    const boardCopy = board.map(row => row.map(piece => piece ? { ...piece } : null));
    
    if (!systemInitialized) {
        initializePieceTables(); // 初始化本地引擎的棋子价值表
        // Zobrist 表由 localEngine.js 内部按需初始化
        systemInitialized = true;
        console.log("AI Worker: System initialized (Piece tables for local engine).");
    }

    const bestMove = await findBestMove(boardCopy, currentColor, plyCount);
    self.postMessage({ bestMove });
};

// --- END OF FILE aiWorker.js ---