// --- START OF FILE cloudMoveFetcher.js ---

import { PIECE_COLOR, PIECE_TYPES, generateLegalMoves } from './gameLogic'; // 假设 gameLogic.js 在同一目录

let cloudCache = new Map();
const CLOUD_API_URL = "http://www.chessdb.cn/chessdb.php"; // 确保此地址可访问 (HTTP)
const CLOUD_API_TIMEOUT = 800; // API 调用超时时间 (毫秒)
// CLOUD_API_TIMEOUT_EARLY_GAME 将在 aiWorker.js 中定义和使用

async function fetchWithTimeout(resource, options = {}, timeout = CLOUD_API_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error; // 由调用者 (getCloudMove) 处理特定日志记录
  }
}

export function boardToFen(board, currentColor) {
    let fen = '';
    for (let y = 0; y < 10; y++) {
        let emptyCount = 0;
        for (let x = 0; x < 9; x++) {
            const piece = board[y][x];
            if (piece) {
                if (emptyCount > 0) {
                    fen += emptyCount;
                    emptyCount = 0;
                }
                let baseFenType;
                switch (piece.type) {
                    case PIECE_TYPES.JIANG: case PIECE_TYPES.SHUAI: baseFenType = 'K'; break;
                    case PIECE_TYPES.SHI: case PIECE_TYPES.SHI_B: baseFenType = 'A'; break;
                    case PIECE_TYPES.XIANG: case PIECE_TYPES.XIANG_B: baseFenType = 'B'; break;
                    case PIECE_TYPES.MA: case PIECE_TYPES.MA_B: baseFenType = 'N'; break;
                    case PIECE_TYPES.JU: case PIECE_TYPES.CHE: baseFenType = 'R'; break;
                    case PIECE_TYPES.PAO: case PIECE_TYPES.PAO_B: baseFenType = 'C'; break;
                    case PIECE_TYPES.BING: case PIECE_TYPES.ZU: baseFenType = 'P'; break;
                    default:
                        console.error("Cloud FEN: Unknown piece type for FEN conversion:", piece.type);
                        baseFenType = '?';
                }
                fen += (piece.color === PIECE_COLOR.RED) ? baseFenType.toUpperCase() : baseFenType.toLowerCase();
            } else {
                emptyCount++;
            }
        }
        if (emptyCount > 0) {
            fen += emptyCount;
        }
        if (y < 9) {
            fen += '/';
        }
    }
    fen += currentColor === PIECE_COLOR.RED ? ' w' : ' b';
    fen += ' - - 0 1'; // 标准 FEN 后缀
    return fen;
}

function apiMoveToInternalMove(apiMoveStrInput) {
    if (typeof apiMoveStrInput !== 'string') {
        return null;
    }
    const apiMoveStr = apiMoveStrInput.trim();

    if (apiMoveStr.length !== 4) {
        return null;
    }

    const fromX_char = apiMoveStr[0];
    const fromY_char = apiMoveStr[1];
    const toX_char = apiMoveStr[2];
    const toY_char = apiMoveStr[3];

    if (!/^[a-i]$/.test(fromX_char) || !/^[a-i]$/.test(toX_char) ||
        !/^[0-9]$/.test(fromY_char) || !/^[0-9]$/.test(toY_char)) {
        console.warn("Cloud API: apiMoveToInternalMove: Invalid characters in API move string:", apiMoveStr);
        return null;
    }

    const fromX = fromX_char.charCodeAt(0) - 'a'.charCodeAt(0);
    const apiFromY = parseInt(fromY_char, 10);
    const toX = toX_char.charCodeAt(0) - 'a'.charCodeAt(0);
    const apiToY = parseInt(toY_char, 10);

    const fromY = 9 - apiFromY;
    const toY = 9 - apiToY;

    if (fromX < 0 || fromX > 8 || fromY < 0 || fromY > 9 ||
        toX < 0 || toX > 8 || toY < 0 || toY > 9) {
        console.error("Cloud API: apiMoveToInternalMove: Move resulted in out-of-bounds internal coordinates.",
                      { apiMoveStr, api_coords: {fromX_char, apiFromY, toX_char, apiToY}, internal_coords: {fromX, fromY, toX, toY} });
        return null;
    }

    return { from: { x: fromX, y: fromY }, to: { x: toX, y: toY } };
}

export async function getCloudMove(fen, boardForValidation, currentColorForValidation, timeout = CLOUD_API_TIMEOUT) {
    if (cloudCache.has(fen)) {
        const cachedMove = cloudCache.get(fen);
        const localLegalMovesForCache = generateLegalMoves(boardForValidation, currentColorForValidation);
        const isCachedMoveLegal = localLegalMovesForCache.some(
            lm => lm.from.x === cachedMove.from.x && lm.from.y === cachedMove.from.y &&
                  lm.to.x === cachedMove.to.x && lm.to.y === cachedMove.to.y
        );
        if(isCachedMoveLegal){
            console.log("Cloud API: Using validated cached cloud move:", cachedMove);
            return cachedMove;
        } else {
            console.warn("Cloud API: Cached move found but deemed illegal on re-validation. FEN:", fen, "Move:", cachedMove, "Removing from cache.");
            cloudCache.delete(fen);
        }
    }

    try {
        const apiUrl = `${CLOUD_API_URL}?action=querybest&board=${encodeURIComponent(fen)}&learn=0`;
        const response = await fetchWithTimeout(apiUrl, {}, timeout);
        if (response.ok) {
            const text = await response.text();
            if (text && !text.startsWith("invalid") && !text.startsWith("unknown") && !text.startsWith("nobestmove") && !text.startsWith("checkmate") && !text.startsWith("stalemate")) {
                let apiMoveStr = null;
                const moveMatch = text.match(/(?:move|egtb):([a-i][0-9][a-i][0-9])/);
                if (moveMatch && moveMatch[1]) {
                    apiMoveStr = moveMatch[1];
                } else {
                    const trimmedText = text.trim();
                    if (/^[a-i][0-9][a-i][0-9]$/.test(trimmedText)) {
                        apiMoveStr = trimmedText;
                        console.log("Cloud API: Parsed move directly from text as it matched format:", apiMoveStr);
                    }
                }

                if (apiMoveStr) {
                    const internalMove = apiMoveToInternalMove(apiMoveStr);
                    if (internalMove) {
                        const localLegalMoves = generateLegalMoves(boardForValidation, currentColorForValidation);
                        const isCloudMoveLegal = localLegalMoves.some(
                            lm => lm.from.x === internalMove.from.x && lm.from.y === internalMove.from.y &&
                                  lm.to.x === internalMove.to.x && lm.to.y === internalMove.to.y
                        );
                        if (isCloudMoveLegal) {
                            console.log("Cloud API: Using validated cloud move:", internalMove, "(from API:", apiMoveStr, ")");
                            cloudCache.set(fen, internalMove);
                            return internalMove;
                        } else {
                            console.warn("Cloud API: Move deemed illegal by local validation. FEN:", fen, "API Move Str:", apiMoveStr, "Parsed Internal:", internalMove);
                            return null;
                        }
                    } else {
                         console.warn("Cloud API: Failed to parse API move string:", apiMoveStr, "Original text:", text);
                         return null;
                    }
                } else {
                    console.warn("Cloud API: API response text did not contain a recognizable move:", text);
                    return null;
                }
            } else {
                 console.warn("Cloud API: API response indicates no best move or error state:", text);
                 return null;
            }
        } else {
            console.warn("Cloud API: API request failed with status:", response.status, "for FEN:", fen);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn(`Cloud API: API request timed out after ${timeout}ms for FEN: ${fen}`);
        } else {
            console.warn(`Cloud API: Error during API call for FEN ${fen}:`, error.message);
        }
    }
    return null;
}

// --- END OF FILE cloudMoveFetcher.js ---