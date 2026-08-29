import React from "react";

const EmployerNavbar = () => {
  return (
    <header className="employer-navbar">

      <div className="navbar-left">

        <button className="mobile-menu-btn">
          ☰
        </button>

        <div className="navbar-search">
          <span>⌕</span>
          <input
            type="text"
            placeholder="Search jobs, candidates..."
          />
        </div>

      </div>


      <div className="navbar-actions">

        <button className="nav-icon-btn">
          🔔
          <span className="notification-dot"></span>
        </button>

        <div className="nav-divider"></div>

        <div className="navbar-profile">

          <div className="navbar-avatar">
            TC
          </div>

          <div className="navbar-profile-info">
            <strong>Talent Corner</strong>
            <span>Employer</span>
          </div>

          <span className="profile-arrow">
            ▾
          </span>

        </div>

      </div>

    </header>
  );
};

export default EmployerNavbar;