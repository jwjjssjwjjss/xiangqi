// --- START OF FILE ChessBoard.js ---

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getInitialBoard, generateLegalMoves, PIECE_COLOR, isKingInCheck } from './gameLogic';
import './ChessBoard.css';

function ChessBoard() {
  const [board, setBoard] = useState(getInitialBoard());
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(PIECE_COLOR.RED);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [gameOver, setGameOver] = useState('');
  const [plyCount, setPlyCount] = useState(0); // 新增 plyCount 状态

  const aiWorkerRef = useRef(null);

  const movePiece = useCallback((from, to) => {
    setBoard(prevBoard => {
      const newBoard = prevBoard.map(row => [...row]);
      newBoard[to.y][to.x] = newBoard[from.y][from.x];
      newBoard[from.y][from.x] = null;
      return newBoard;
    });
    setSelectedPiece(null);
    setPossibleMoves([]);

    setCurrentPlayer(prevPlayer =>
      prevPlayer === PIECE_COLOR.RED ? PIECE_COLOR.BLACK : PIECE_COLOR.RED
    );
    setPlyCount(prevPly => prevPly + 1); // 每次移动后增加 plyCount
  }, []); // movePiece 现在是稳定的, setPlyCount 也是稳定的

  useEffect(() => {
    if (!aiWorkerRef.current) {
      aiWorkerRef.current = new Worker(new URL('./aiWorker.js', import.meta.url));

      aiWorkerRef.current.onmessage = (event) => {
        const { bestMove, error } = event.data; // Check for error too
        if (error) {
          console.error("AI Worker returned an error:", error);
          // Potentially handle UI feedback for AI error
        } else if (bestMove) {
          movePiece(bestMove.from, bestMove.to);
        } else {
          console.warn("AI Worker returned no best move and no error.");
          // This might happen if AI determines no legal moves (e.g., stalemate/checkmate detected by AI)
          // or if there was an unexpected issue.
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
  }, [movePiece]);

  const checkForEndGame = useCallback((currentBoard, nextPlayer) => {
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
  }, []);

  useEffect(() => {
    if (board && currentPlayer) {
      checkForEndGame(board, currentPlayer);
    }
  }, [board, currentPlayer, checkForEndGame]);


  useEffect(() => {
    if (currentPlayer === PIECE_COLOR.BLACK && !isAiThinking && !gameOver && aiWorkerRef.current) {
      setIsAiThinking(true);
      // 发送消息时包含 plyCount
      aiWorkerRef.current.postMessage({
        board: board,
        currentColor: PIECE_COLOR.BLACK,
        plyCount: plyCount // 添加 plyCount
      });
    }
    // 将 plyCount 添加到依赖项数组
  }, [currentPlayer, board, isAiThinking, gameOver, plyCount]);

  useEffect(() => {
    if (selectedPiece && currentPlayer === PIECE_COLOR.RED) { // Ensure only human player can see their moves
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
    setBoard(getInitialBoard());
    setCurrentPlayer(PIECE_COLOR.RED);
    setSelectedPiece(null);
    setPossibleMoves([]);
    setIsAiThinking(false);
    setGameOver('');
    setPlyCount(0); // 重置时也将 plyCount 设为 0
    if (aiWorkerRef.current) {
      // Worker state is generally reset per message for findBestMove,
      // but if it had persistent state across calls, you might send a reset message.
      // For this setup, it's usually not needed as findBestMove initializes.
    }
  }, []); // setPlyCount is stable

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