import React from "react";

const StatusBadge = ({ status }) => {

  const statusClass =
    status?.toLowerCase() === "active"
      ? "status-active"
      : status?.toLowerCase() === "closed"
      ? "status-closed"
      : "status-draft";

  return (
    <span className={`status-badge ${statusClass}`}>
      {status}
    </span>
  );
};

export default StatusBadge;