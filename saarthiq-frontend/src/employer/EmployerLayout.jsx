import React from "react";
import { Outlet } from "react-router-dom";

import EmployerSidebar from "./components/EmployerSidebar";
import EmployerNavbar from "./components/EmployerNavbar";

import "./Employer.css";

function EmployerLayout() {
  return (
    <div className="employer-layout">

      {/* Sidebar */}
      <EmployerSidebar />

      {/* Main Area */}
      <div className="employer-content">

        {/* Navbar */}
        <EmployerNavbar />

        {/* Current Employer Page */}
        <main className="employer-main">
          <Outlet />
        </main>

      </div>

    </div>
  );
}

export default EmployerLayout;