import React from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "./StatusBadge";

const JobCard = ({ job }) => {

  const navigate = useNavigate();

  return (
    <div className="job-card">

      <div className="job-card-top">

        <div className="job-company-icon">
          {job.companyIcon || "💼"}
        </div>

        <StatusBadge status={job.status} />

      </div>

      <h3>{job.title}</h3>

      <p className="job-company">
        🏢 {job.company}
      </p>

      <div className="job-details">

        <span>📍 {job.location}</span>

        <span>💼 {job.type}</span>

      </div>

      <div className="job-card-footer">

        <div>
          <strong>{job.applications}</strong>
          <span> Applications</span>
        </div>

        <button
          className="job-view-btn"
          onClick={() =>
            navigate("/employer/job-preview")
          }
        >
          View →
        </button>

      </div>

    </div>
  );
};

export default JobCard;