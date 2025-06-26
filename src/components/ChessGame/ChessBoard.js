// --- START OF FILE ChessBoard.js ---

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getInitialBoard, generateLegalMoves, PIECE_COLOR, isKingInCheck } from './gameLogic';
// Import Zobrist functions from localEngine (or a shared utility if refactored)
import { initZobristForLocalEngine, computeZobristKeyForLocalEngine } from './localEngine'; 
import './ChessBoard.css';

function ChessBoard() {
  const [board, setBoard] = useState(getInitialBoard());
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(PIECE_COLOR.RED);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [gameOver, setGameOver] = useState('');
  const [plyCount, setPlyCount] = useState(0);
  // State for repetition history: Map<ZobristKey (BigInt), Count (number)>
  const [repetitionHistory, setRepetitionHistory] = useState(new Map());

  const aiWorkerRef = useRef(null);

  // Initialize Zobrist table and set initial board repetition count
  useEffect(() => {
    initZobristForLocalEngine(); // Initialize Zobrist table globally (idempotent)
    const initialBoardKey = computeZobristKeyForLocalEngine(getInitialBoard());
    setRepetitionHistory(prevMap => {
        const newMap = new Map(prevMap); // prevMap should be empty initially
        newMap.set(initialBoardKey, 1);
        return newMap;
    });
  }, []); // Runs once on mount


  const checkForRepetitionDraw = useCallback((currentBoardKey, history) => {
    const count = history.get(currentBoardKey) || 0;
    if (count >= 5) {
      setGameOver('和棋（5次重复局面）！');
      setTimeout(() => alert('和棋（5次重复局面）！'), 10);
      return true;
    }
    return false;
  }, []); // setGameOver is stable

  const movePiece = useCallback((from, to) => {
    let newBoardKey; // To store the Zobrist key of the board *after* the move
    setBoard(prevBoard => {
      const newBoard = prevBoard.map(row => [...row]);
      newBoard[to.y][to.x] = newBoard[from.y][from.x];
      newBoard[from.y][from.x] = null;
      newBoardKey = computeZobristKeyForLocalEngine(newBoard); // Compute key for new board state
      return newBoard;
    });
    setSelectedPiece(null);
    setPossibleMoves([]);
    
    // Update repetition history
    setRepetitionHistory(prevHistory => {
        const newHistory = new Map(prevHistory);
        const currentCount = newHistory.get(newBoardKey) || 0;
        newHistory.set(newBoardKey, currentCount + 1);
        console.log(`Board state repeated ${currentCount + 1} times. Key: ${newBoardKey}`);
        // Check for repetition draw immediately after updating history
        // This check will use the just-updated history.
        // No, this check must be outside, after setRepetitionHistory has completed.
        // Or, do the check here based on newHistory before returning it.
        // For simplicity, it's done in the useEffect hook for board changes.
        return newHistory;
    });

    setCurrentPlayer(prevPlayer =>
      prevPlayer === PIECE_COLOR.RED ? PIECE_COLOR.BLACK : PIECE_COLOR.RED
    );
    setPlyCount(prevPly => prevPly + 1); 
  }, []); 

  useEffect(() => {
    if (!aiWorkerRef.current) {
      aiWorkerRef.current = new Worker(new URL('./aiWorker.js', import.meta.url));
      aiWorkerRef.current.onmessage = (event) => {
        const { bestMove, error } = event.data; 
        if (error) {
          console.error("AI Worker returned an error:", error);
        } else if (bestMove) {
          movePiece(bestMove.from, bestMove.to);
        } else {
          console.warn("AI Worker returned no best move and no error.");
        }
        setIsAiThinking(false);
      };
      aiWorkerRef.current.onerror = (error) => {
        console.error("AI Worker error (onerror):", error);
        setIsAiThinking(false);
      };
    }
    return () => {
      if (aiWorkerRef.current) {
        aiWorkerRef.current.terminate();
        aiWorkerRef.current = null;
      }
    };
  }, [movePiece]); // movePiece is now stable due to useCallback

  const checkForEndGame = useCallback((currentBoard, nextPlayer, currentBoardKey, history) => {
    // 1. Check for repetition draw first
    if (checkForRepetitionDraw(currentBoardKey, history)) {
        return true;
    }

    // 2. Check for checkmate/stalemate
    const legalMoves = generateLegalMoves(currentBoard, nextPlayer);
    if (legalMoves.length === 0) {
      if (isKingInCheck(currentBoard, nextPlayer)) {
        const winner = nextPlayer === PIECE_COLOR.RED ? '黑方' : '红方';
        setGameOver(`${winner} 胜利！`);
        setTimeout(() => alert(`${winner} 胜利！`), 10);
      } else {
        setGameOver('和棋（困死）！');
        setTimeout(() => alert('和棋（困死）！'), 10);
      }
      return true;
    }
    return false;
  }, [checkForRepetitionDraw]); // Added checkForRepetitionDraw dependency

  useEffect(() => {
    if (board && currentPlayer && repetitionHistory.size > 0 && !gameOver) { // Ensure repetitionHistory is initialized
      const currentBoardKey = computeZobristKeyForLocalEngine(board);
      // Check for game end conditions after board/player/history update
      // This is called after every move (player or AI) due to dependencies.
      if (!gameOver) { // Re-check gameOver as it might be set by repetition check inside checkForEndGame
          checkForEndGame(board, currentPlayer, currentBoardKey, repetitionHistory);
      }
    }
  }, [board, currentPlayer, repetitionHistory, checkForEndGame, gameOver]);


  useEffect(() => {
    if (currentPlayer === PIECE_COLOR.BLACK && !isAiThinking && !gameOver && aiWorkerRef.current) {
      setIsAiThinking(true);
      // Pass a copy of the repetition history to the worker
      aiWorkerRef.current.postMessage({
        board: board,
        currentColor: PIECE_COLOR.BLACK,
        plyCount: plyCount,
        repetitionHistory: new Map(repetitionHistory) // Pass history
      });
    }
  }, [currentPlayer, board, isAiThinking, gameOver, plyCount, repetitionHistory]); // Added repetitionHistory

  useEffect(() => {
    if (selectedPiece && currentPlayer === PIECE_COLOR.RED) { 
      const moves = generateLegalMoves(board, PIECE_COLOR.RED, selectedPiece);
      setPossibleMoves(moves.map(m => m.to));
    } else {
      setPossibleMoves([]);
    }
  }, [selectedPiece, board, currentPlayer]);


  const handleSquareClick = useCallback((x, y) => {
    if (gameOver || currentPlayer === PIECE_COLOR.BLACK || isAiThinking) return;

    if (selectedPiece) {
      const isMovePossible = possibleMoves.some(move => move.x === x && move.y === y);
      if (isMovePossible) {
        movePiece(selectedPiece, { x, y });
      } else {
        const clickedPiece = board[y][x];
        if (clickedPiece && clickedPiece.color === PIECE_COLOR.RED) {
          setSelectedPiece({ x, y });
        } else {
          setSelectedPiece(null);
        }
      }
    } else {
      const piece = board[y][x];
      if (piece && piece.color === PIECE_COLOR.RED) {
        setSelectedPiece({ x, y });
      }
    }
  }, [board, currentPlayer, gameOver, isAiThinking, possibleMoves, selectedPiece, movePiece]);

  const handleReset = useCallback(() => {
    const initialBrd = getInitialBoard();
    setBoard(initialBrd);
    setCurrentPlayer(PIECE_COLOR.RED);
    setSelectedPiece(null);
    setPossibleMoves([]);
    setIsAiThinking(false);
    setGameOver('');
    setPlyCount(0); 
    
    // Reset repetition history for the new game
    const initialBoardKey = computeZobristKeyForLocalEngine(initialBrd);
    setRepetitionHistory(() => {
        const map = new Map();
        map.set(initialBoardKey, 1);
        return map;
    });
    
  }, []); 

  const getTurnText = () => {
    if (gameOver) return gameOver;
    if (isAiThinking) return '电脑正在思考...';
    return currentPlayer === PIECE_COLOR.RED ? '轮到你啦，亲爱的！' : '电脑回合';
  }

  return (
    <div className="chess-board-container">
      <div className={`turn-indicator ${currentPlayer}`}>
        {getTurnText()}
      </div>
      <div className="chess-board">
        {board.map((row, y) =>
          row.map((piece, x) => (
            <div
              key={`${y}-${x}`}
              className={`square ${selectedPiece && selectedPiece.x === x && selectedPiece.y === y ? 'selected' : ''} ${possibleMoves.some(m => m.x === x && m.y === y) ? 'highlight' : ''}`}
              onClick={() => handleSquareClick(x, y)}
            >
              {piece && <div className={`piece ${piece.color}`}>{piece.type}</div>}
            </div>
          ))
        )}
      </div>
      <button onClick={handleReset} className="reset-button">
        重新开始一局
      </button>
    </div>
  );
}

export default ChessBoard;

// --- END OF FILE ChessBoard.js ---