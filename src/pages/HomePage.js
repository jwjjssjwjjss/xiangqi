import React from 'react';
import PulsingHeart from '../components/PulsingHeart';
import DayCounter from '../components/DayCounter';
import '../styles/HomePage.css';

function HomePage() {
  return (
    <div className="home-page">
      {/* ====================================================== */}
      {/* == 在这里修改你想对她说的话和她的名字！             == */}
      {/* ====================================================== */}
      <h1 className="title cute-font">To My Dearest 宝宝 ❤️</h1>
      
      <p className="message">
        遇见你的那天，是我生命中最美的意外。
        <br />
        愿未来的每一天，我们都能像现在这样，充满欢声笑语。
        <br />
        我爱你！
      </p>

      <PulsingHeart />

      <DayCounter />
    </div>
  );
}

export default HomePage;
    
