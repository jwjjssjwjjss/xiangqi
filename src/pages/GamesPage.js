import React from 'react';
import ChessBoard from '../components/ChessGame/ChessBoard'; // 引入我们自己的象棋组件

function GamesPage() {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1 className="cute-font" style={{ color: '#d81b60', fontSize: '3em' }}>
        爱的小游戏乐园
      </h1>
      <p style={{ fontSize: '1.2em', color: '#5d4037', marginBottom: '20px' }}>
        亲爱的，我们来下一盘棋吧！
      </p>
      
      {/* 在这里使用我们自己写的象棋组件 */}
      <ChessBoard />

    </div>
  );
}

export default GamesPage;