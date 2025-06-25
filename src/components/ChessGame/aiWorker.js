// --- START OF FILE aiWorker.js ---
/* eslint-disable no-restricted-globals */

import { PIECE_COLOR, PIECE_TYPES, generateLegalMoves } from './gameLogic.js'; // 假设 gameLogic.js 在同一目录
import { getCloudMove, boardToFen } from './cloudMoveFetcher.js';
import { getLocalEngineMove, initializePieceTables } from './localEngine.js';

const CLOUD_API_TIMEOUT_PRIMARY_ATTEMPT = 2000; // 云端主要尝试超时时间 (formerly CLOUD_API_TIMEOUT_EARLY_GAME)
const LOCAL_ENGINE_FALLBACK_MIN_THINK_TIME_MS = 1000; // 如果云端失败，本地引擎至少思考1秒

// -------------------------------------------------------------------
// 5. Main AI Decision Logic (findBestMove)
// -------------------------------------------------------------------
async function findBestMove(board, currentColor, plyCount) {
    const overallStartTime = Date.now();
    const fen = boardToFen(board, currentColor);
    console.log(`AI Worker: Finding best move for FEN: ${fen}, Ply: ${plyCount}`);

    let finalMove = null;
    let moveSource = "None";
    
    // The 'board' argument is already a deep copy made in the onmessage handler.
    // boardCopyForValidation is an additional copy specifically for cloud move fetching,
    // in case it performs any speculative modifications.
    const boardCopyForValidation = board.map(row => row.map(p => p ? {...p} : null));

    console.log(`AI Worker: Prioritizing Cloud move with timeout ${CLOUD_API_TIMEOUT_PRIMARY_ATTEMPT}ms.`);
    
    let cloudMove = null;
    let cloudError = null;
    try {
        cloudMove = await getCloudMove(fen, boardCopyForValidation, currentColor, CLOUD_API_TIMEOUT_PRIMARY_ATTEMPT);
    } catch (error) {
        cloudError = error;
        console.error(`AI Worker: Error during getCloudMove (Ply ${plyCount}):`, error);
    }

    if (cloudMove) {
        finalMove = cloudMove;
        moveSource = "Cloud";
        console.log("AI Worker: Using Cloud move.");
    } else {
        // Cloud move failed or errored, fallback to local engine
        if (cloudError) {
            console.warn(`AI Worker: Cloud move errored (Ply ${plyCount}). Falling back to local engine with ${LOCAL_ENGINE_FALLBACK_MIN_THINK_TIME_MS}ms min think time.`);
        } else {
            console.warn(`AI Worker: Cloud move not found/timeout (Ply ${plyCount}). Falling back to local engine with ${LOCAL_ENGINE_FALLBACK_MIN_THINK_TIME_MS}ms min think time.`);
        }
        
        const localEngineStartTime = Date.now();
        // Use the 'board' (which is the copy from onmessage) for local engine
        const localFallbackMove = await getLocalEngineMove(board, currentColor, overallStartTime);
        const localEngineDuration = Date.now() - localEngineStartTime;
        
        const delayNeeded = Math.max(0, LOCAL_ENGINE_FALLBACK_MIN_THINK_TIME_MS - localEngineDuration);
        if (delayNeeded > 0) {
            console.log(`AI Worker: Local engine (fallback) computed in ${localEngineDuration}ms. Waiting an additional ${delayNeeded}ms.`);
            await new Promise(resolve => setTimeout(resolve, delayNeeded));
        }

        if (localFallbackMove) {
            finalMove = localFallbackMove;
            moveSource = cloudError ? "Local (Cloud Error Fallback)" : "Local (Cloud Failed/Timeout Fallback)";
            console.log(`AI Worker: Using Local move from fallback. Local compute: ${localEngineDuration}ms. Total effective local processing time: ${localEngineDuration + delayNeeded}ms.`);
        } else {
            console.warn(`AI Worker: Local engine also failed to find a move in fallback (Ply ${plyCount}).`);
            moveSource = "None (Cloud and Local Failed)"; 
            // finalMove remains null, will proceed to ultimate fallback logic
        }
    }
    
    // Final Validation of the chosen move (if any)
    if (finalMove) {
        // Use a fresh board copy for validation to ensure no side effects from prior logic
        const finalValidationBoard = board.map(row => row.map(p => p ? {...p} : null));
        const legalMovesForFinalCheck = generateLegalMoves(finalValidationBoard, currentColor);
        const isFinalMoveLegit = legalMovesForFinalCheck.some(
            lm => lm.from.x === finalMove.from.x && lm.from.y === finalMove.from.y &&
                  lm.to.x === finalMove.to.x && lm.to.y === finalMove.to.y
        );

        if (!isFinalMoveLegit) {
            console.error(`AI Worker: CRITICAL - Chosen finalMove from ${moveSource} is ILLEGAL! Move: ${JSON.stringify(finalMove)}.`);
            console.error(`Board state (FEN for final check): ${boardToFen(finalValidationBoard, currentColor)}`);
            console.error(`Legal moves available for final check (${legalMovesForFinalCheck.length}): ${JSON.stringify(legalMovesForFinalCheck.slice(0,5))}...`);
            finalMove = null; // Invalidate the illegal move
            moveSource += " (Illegal, Fallback!)"; // Append to existing source for tracking
        } else {
             // If move is legal, proceed with pre-fetching for the *next* AI turn
             preFetchNextMoves(board, currentColor, finalMove, plyCount + 1);
        }
    }
    
    // Ultimate Fallback: If no move found from any source, or if chosen move was illegal
    if (!finalMove) {
        console.warn(`AI Worker: No valid move from primary sources (Ply ${plyCount}, Prev Source: ${moveSource}). Fallback to first legal move.`);
        const fallbackBoard = board.map(row => row.map(p => p ? {...p} : null));
        const legalMoves = generateLegalMoves(fallbackBoard, currentColor);
        if (legalMoves.length > 0) {
            finalMove = legalMoves[0]; // Pick the first legal move
            
            if (moveSource.includes("(Illegal, Fallback!)")) {
                // Keep the original source info if it was an illegal move that led here
            } else if (moveSource === "None (Cloud and Local Failed)") {
                moveSource = "Fallback (First Legal after Cloud/Local Fail)";
            } else {
                 moveSource = "Fallback (First Legal)";
            }
            
            console.log("AI Worker: Using first legal move as ultimate fallback:", finalMove);
            preFetchNextMoves(board, currentColor, finalMove, plyCount + 1);
        } else {
            console.error(`AI Worker: CRITICAL - No legal moves available for fallback (Ply ${plyCount}). No move possible.`);
            moveSource = "None (No Legal Moves)"; 
        }
    }

    const totalTime = Date.now() - overallStartTime;
    let moveStr = 'None';
    if (finalMove) {
        moveStr = `from (${finalMove.from.x},${finalMove.from.y}) to (${finalMove.to.x},${finalMove.to.y})`;
        if (finalMove.piece && finalMove.piece.type) { 
            moveStr += ` piece: ${finalMove.piece.type}`;
        } else {
            // Attempt to get piece type from board if move object doesn't have it
            const pieceOnBoard = board[finalMove.from.y]?.[finalMove.from.x];
            if (pieceOnBoard) moveStr += ` piece: ${pieceOnBoard.type}`;
        }
    }
    console.log(`AI Worker: Ply: ${plyCount}. Final Move: ${moveStr}. Source: ${moveSource}. Total Time: ${totalTime}ms.`);
    return finalMove;
}

// -------------------------------------------------------------------
// 6. Pre-fetching Logic
// -------------------------------------------------------------------
async function preFetchNextMoves(originalBoard, aiColor, aiBestMove, currentPlyAfterAIMove) {
    // Create a deep copy of the board to simulate AI's move
    const boardAfterAIMove = originalBoard.map(row => row.map(piece => piece ? { ...piece } : null));
    
    // Check if the 'from' position is valid before accessing
    const movingPieceForAI = boardAfterAIMove[aiBestMove.from.y]?.[aiBestMove.from.x];
    
    if (!movingPieceForAI) {
        console.error("AI Pre-fetch: No piece at AI's 'from' position for simulation.", aiBestMove.from, "Board state:", boardAfterAIMove);
        return;
    }
    
    // Simulate AI's move
    boardAfterAIMove[aiBestMove.to.y][aiBestMove.to.x] = { ...movingPieceForAI };
    boardAfterAIMove[aiBestMove.from.y][aiBestMove.from.x] = null;

    // Determine opponent's color and generate their legal moves
    const opponentColor = (aiColor === PIECE_COLOR.RED ? PIECE_COLOR.BLACK : PIECE_COLOR.RED);
    const opponentLegalMoves = generateLegalMoves(boardAfterAIMove, opponentColor);

    if (opponentLegalMoves.length === 0) {
        // console.log("AI Pre-fetch: No legal moves for opponent, nothing to pre-fetch.");
        return;
    }

    const MAX_PREFETCH_MOVES = 3; // Limit the number of opponent moves to consider for pre-fetching
    const movesToPrefetch = opponentLegalMoves.slice(0, MAX_PREFETCH_MOVES);
    const defaultCloudTimeoutForPrefetch = 800; // Timeout for pre-fetch cloud calls

    // console.log(`AI Pre-fetch: Considering ${movesToPrefetch.length} opponent moves for pre-fetching.`);

    movesToPrefetch.forEach(opponentMove => {
        // Create a new board state for each potential opponent move
        const boardAfterOpponentMove = boardAfterAIMove.map(row => row.map(piece => piece ? { ...piece } : null));
        const movingPieceForOpponent = boardAfterOpponentMove[opponentMove.from.y]?.[opponentMove.from.x];

        if (!movingPieceForOpponent) {
            console.error("AI Pre-fetch: No piece at opponent's 'from' for simulation.", opponentMove.from);
            return; // Skip this pre-fetch if piece is unexpectedly missing
        }
        
        // Simulate opponent's move
        boardAfterOpponentMove[opponentMove.to.y][opponentMove.to.x] = { ...movingPieceForOpponent };
        boardAfterOpponentMove[opponentMove.from.y][opponentMove.from.x] = null;
        
        const nextFenForAI = boardToFen(boardAfterOpponentMove, aiColor); // FEN for AI's *next* turn

        // Asynchronously call getCloudMove. It handles caching internally.
        // We don't need to await this or use its result directly, it's just for warming the cache.
        // console.log(`AI Pre-fetch: Querying for FEN: ${nextFenForAI} (Ply ${currentPlyAfterAIMove + 1})`);
        getCloudMove(nextFenForAI, boardAfterOpponentMove, aiColor, defaultCloudTimeoutForPrefetch)
            .then(move => {
                // if (move) { console.log(`AI Pre-fetch: Successfully fetched/cached move for FEN ${nextFenForAI}`); }
                // else { console.warn(`AI Pre-fetch: Failed to get/validate move for FEN ${nextFenForAI} during pre-fetch.`); }
            })
            .catch(e => { 
                // console.warn(`AI Pre-fetch: Error in background fetch for FEN ${nextFenForAI}: ${e.message}`); 
            });
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

    // Create a deep copy of the board to prevent modifications to the main thread's state
    const boardCopy = board.map(row => row.map(piece => piece ? { ...piece } : null));
    
    if (!systemInitialized) {
        initializePieceTables(); // Initialize local engine's piece value tables (if not already done by localEngine itself)
        // Zobrist tables are typically initialized lazily by the local engine as needed.
        systemInitialized = true;
        console.log("AI Worker: System initialized (Piece tables for local engine).");
    }

    try {
        const bestMove = await findBestMove(boardCopy, currentColor, plyCount);
        self.postMessage({ bestMove });
    } catch (error) {
        console.error("AI Worker: Unhandled error in findBestMove:", error);
        self.postMessage({ bestMove: null, error: "Unhandled error in AI worker." });
    }
};

// --- END OF FILE aiWorker.js ---