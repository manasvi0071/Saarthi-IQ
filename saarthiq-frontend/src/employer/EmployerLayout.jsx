import React from "react";
import EmployerSidebar from "./components/EmployerSidebar";
import EmployerNavbar from "./components/EmployerNavbar";
import "./Employer.css";

const EmployerLayout = ({ children }) => {
  return (
    <div className="employer-layout">

      <EmployerSidebar />

      <div className="employer-content">

        <EmployerNavbar />

        <main className="employer-main">
          {children}
        </main>

      </div>

    </div>
  );
};

export default EmployerLayout;