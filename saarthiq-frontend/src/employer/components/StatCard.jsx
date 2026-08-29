import React from "react";

const StatCard = ({
  title,
  value,
  icon,
  type
}) => {
  return (
    <div className={`stat-card ${type || ""}`}>

      <div className="stat-icon">
        {icon}
      </div>

      <div className="stat-info">
        <span>{title}</span>
        <strong>{value}</strong>
      </div>

      <div className="stat-decoration"></div>

    </div>
  );
};

export default StatCard;