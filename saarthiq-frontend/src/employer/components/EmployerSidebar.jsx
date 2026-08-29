import React from "react";
import { NavLink } from "react-router-dom";

const EmployerSidebar = () => {
  const menuItems = [
    {
      name: "Dashboard",
      icon: "▦",
      path: "/employer"
    },
    {
      name: "Company Profile",
      icon: "▣",
      path: "/employer/company-profile"
    },
    {
      name: "Create New Job",
      icon: "＋",
      path: "/employer/create-job"
    },
    {
      name: "Posted Jobs",
      icon: "▤",
      path: "/employer/posted-jobs"
    }
  ];

  return (
    <aside className="employer-sidebar">

      {/* LOGO */}

      <div className="sidebar-logo">

        <div className="sidebar-logo-icon">
          S
        </div>

        <div>
          <h2>Saarthi</h2>
          <span>EMPLOYER</span>
        </div>

      </div>


      {/* MENU */}

      <div className="sidebar-section-title">
        MAIN MENU
      </div>

      <nav className="sidebar-menu">

        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/employer"}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "active" : ""}`
            }
          >

            <span className="sidebar-icon">
              {item.icon}
            </span>

            <span>
              {item.name}
            </span>

          </NavLink>
        ))}

      </nav>


      {/* BOTTOM */}

      <div className="sidebar-bottom">

        <div className="sidebar-help">

          <div className="help-icon">
            ?
          </div>

          <div>
            <strong>Need Help?</strong>
            <span>Contact support</span>
          </div>

        </div>


        <div className="sidebar-user">

          <div className="user-avatar">
            TC
          </div>

          <div className="user-info">
            <strong>Talent Corner</strong>
            <span>Employer</span>
          </div>

          <span className="user-more">
            ⋮
          </span>

        </div>

      </div>

    </aside>
  );
};

export default EmployerSidebar;