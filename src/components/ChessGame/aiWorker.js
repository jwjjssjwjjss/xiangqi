// --- START OF FILE aiWorker.js ---
/* eslint-disable no-restricted-globals */

import { PIECE_COLOR, PIECE_TYPES, generateLegalMoves } from './gameLogic.js'; // 假设 gameLogic.js 在同一目录
import { getCloudMove, boardToFen } from './cloudMoveFetcher.js';
import { getLocalEngineMove, initializePieceTables, initZobristForLocalEngine, computeZobristKeyForLocalEngine } from './localEngine.js'; // Added Zobrist related imports

const CLOUD_API_TIMEOUT_PRIMARY_ATTEMPT = 2000; 
const LOCAL_ENGINE_FALLBACK_MIN_THINK_TIME_MS = 1000; 

// -------------------------------------------------------------------
// 5. Main AI Decision Logic (findBestMove)
// -------------------------------------------------------------------
async function findBestMove(board, currentColor, plyCount, repetitionHistory) { // Added repetitionHistory
    const overallStartTime = Date.now();
    const fen = boardToFen(board, currentColor);
    console.log(`AI Worker: Finding best move for FEN: ${fen}, Ply: ${plyCount}, Rep History Size: ${repetitionHistory.size}`);

    let finalMove = null;
    let moveSource = "None";
    
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
        if (cloudError) {
            console.warn(`AI Worker: Cloud move errored (Ply ${plyCount}). Falling back to local engine with ${LOCAL_ENGINE_FALLBACK_MIN_THINK_TIME_MS}ms min think time.`);
        } else {
            console.warn(`AI Worker: Cloud move not found/timeout (Ply ${plyCount}). Falling back to local engine with ${LOCAL_ENGINE_FALLBACK_MIN_THINK_TIME_MS}ms min think time.`);
        }
        
        const localEngineStartTime = Date.now();
        // Pass repetitionHistory to local engine
        const localFallbackMove = await getLocalEngineMove(board, currentColor, overallStartTime, repetitionHistory);
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
            console.error(`AI Worker: CRITICAL - Chosen finalMove from ${moveSource} is ILLEGAL! Move: ${JSON.stringify(finalMove)}.`);
            console.error(`Board state (FEN for final check): ${boardToFen(finalValidationBoard, currentColor)}`);
            console.error(`Legal moves available for final check (${legalMovesForFinalCheck.length}): ${JSON.stringify(legalMovesForFinalCheck.slice(0,5))}...`);
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
            
            if (moveSource.includes("(Illegal, Fallback!)")) {
                // Keep original source
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
        const pieceOnBoard = board[finalMove.from.y]?.[finalMove.from.x];
        if (pieceOnBoard) moveStr += ` piece: ${pieceOnBoard.type}`;
    }
    console.log(`AI Worker: Ply: ${plyCount}. Final Move: ${moveStr}. Source: ${moveSource}. Total Time: ${totalTime}ms.`);
    return finalMove;
}

// -------------------------------------------------------------------
// 6. Pre-fetching Logic (unchanged from previous version for this task)
// -------------------------------------------------------------------
async function preFetchNextMoves(originalBoard, aiColor, aiBestMove, currentPlyAfterAIMove) {
    const boardAfterAIMove = originalBoard.map(row => row.map(piece => piece ? { ...piece } : null));
    const movingPieceForAI = boardAfterAIMove[aiBestMove.from.y]?.[aiBestMove.from.x];
    if (!movingPieceForAI) {
        console.error("AI Pre-fetch: No piece at AI's 'from' position for simulation.", aiBestMove.from, "Board state:", boardAfterAIMove);
        return;
    }
    boardAfterAIMove[aiBestMove.to.y][aiBestMove.to.x] = { ...movingPieceForAI };
    boardAfterAIMove[aiBestMove.from.y][aiBestMove.from.x] = null;
    const opponentColor = (aiColor === PIECE_COLOR.RED ? PIECE_COLOR.BLACK : PIECE_COLOR.RED);
    const opponentLegalMoves = generateLegalMoves(boardAfterAIMove, opponentColor);

    if (opponentLegalMoves.length === 0) {
        return;
    }
    const MAX_PREFETCH_MOVES = 3; 
    const movesToPrefetch = opponentLegalMoves.slice(0, MAX_PREFETCH_MOVES);
    const defaultCloudTimeoutForPrefetch = 800; 

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
        getCloudMove(nextFenForAI, boardAfterOpponentMove, aiColor, defaultCloudTimeoutForPrefetch)
            .then(_move => { /* console.log for success/fail if needed */ })
            .catch(_e => { /* console.warn for error if needed */ });
    });
}

// -------------------------------------------------------------------
// Worker Message Handler
// -------------------------------------------------------------------
let systemInitialized = false;

self.onmessage = async (event) => {
    // Added repetitionHistory to destructuring
    const { board, currentColor, plyCount, repetitionHistory } = event.data;

    if (board === undefined || currentColor === undefined || plyCount === undefined || repetitionHistory === undefined) { // Check repetitionHistory
        console.error("AI Worker: Invalid message. Missing board, currentColor, plyCount, or repetitionHistory.", event.data);
        self.postMessage({ bestMove: null, error: "Invalid input to worker." });
        return;
    }

    const boardCopy = board.map(row => row.map(piece => piece ? { ...piece } : null));
    // repetitionHistory is a Map, it's passed by structured cloning, so it's already a copy.
    
    if (!systemInitialized) {
        initializePieceTables(); 
        initZobristForLocalEngine(); // Ensure Zobrist is initialized in the worker context
        systemInitialized = true;
        console.log("AI Worker: System initialized (Piece tables & Zobrist for local engine).");
    }

    try {
        // Pass repetitionHistory to findBestMove
        const bestMove = await findBestMove(boardCopy, currentColor, plyCount, repetitionHistory);
        self.postMessage({ bestMove });
    } catch (error) {
        console.error("AI Worker: Unhandled error in findBestMove:", error);
        self.postMessage({ bestMove: null, error: "Unhandled error in AI worker." });
    }
};

// --- END OF FILE aiWorker.js ---