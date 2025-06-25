import React from 'react';
import { NavLink } from 'react-router-dom';

function Header() {
  const navLinkStyles = ({ isActive }) => {
    return {
      fontWeight: isActive ? 'bold' : 'normal',
      textDecoration: 'none',
    };
  };

  return (
    <header className="header cute-font">
      <nav className="nav">
        <NavLink to="/" style={navLinkStyles}>
          我们的主页
        </NavLink>
        <NavLink to="/games" style={navLinkStyles}>
          爱的小游戏
        </NavLink>
      </nav>
    </header>
  );
}

export default Header;
    
