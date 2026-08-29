import React from "react";
import { useNavigate } from "react-router-dom";

const EmployerDashboard = () => {

  const navigate = useNavigate();

  const jobs = [
    {
      title: "Frontend Developer",
      location: "Mumbai, India",
      type: "Full Time",
      applicants: 28,
      status: "Active",
      date: "Aug 28, 2026"
    },
    {
      title: "React Developer",
      location: "Remote",
      type: "Full Time",
      applicants: 42,
      status: "Active",
      date: "Aug 25, 2026"
    },
    {
      title: "UI/UX Designer",
      location: "Mumbai, India",
      type: "Internship",
      applicants: 18,
      status: "Closed",
      date: "Aug 20, 2026"
    }
  ];

  return (
    <div className="dashboard-page">

      {/* HEADER */}

      <div className="dashboard-header">

        <div>
          <span className="dashboard-welcome">
            Welcome back 👋
          </span>

          <h1>Employer Dashboard</h1>

          <p>
            Manage your jobs and find the right talent.
          </p>
        </div>

        <button
          className="primary-btn"
          onClick={() => navigate("/employer/create-job")}
        >
          ＋ Create New Job
        </button>

      </div>


      {/* STATS */}

      <div className="stats-grid">

        <div className="stat-card">

          <div className="stat-icon purple-stat">
            💼
          </div>

          <div className="stat-content">
            <span>Total Jobs</span>
            <strong>24</strong>
            <small>↑ 12% this month</small>
          </div>

        </div>


        <div className="stat-card">

          <div className="stat-icon blue-stat">
            👥
          </div>

          <div className="stat-content">
            <span>Total Applicants</span>
            <strong>186</strong>
            <small>↑ 18% this month</small>
          </div>

        </div>


        <div className="stat-card">

          <div className="stat-icon green-stat">
            ✓
          </div>

          <div className="stat-content">
            <span>Active Jobs</span>
            <strong>18</strong>
            <small>6 closing soon</small>
          </div>

        </div>


        <div className="stat-card">

          <div className="stat-icon orange-stat">
            ★
          </div>

          <div className="stat-content">
            <span>Profile Views</span>
            <strong>1,284</strong>
            <small>↑ 24% this month</small>
          </div>

        </div>

      </div>


      {/* CONTENT */}

      <div className="dashboard-grid">

        {/* JOBS */}

        <div className="dashboard-card jobs-card">

          <div className="dashboard-card-header">

            <div>
              <h2>Recent Jobs</h2>
              <p>Your recently posted jobs</p>
            </div>

            <button
              className="text-btn"
              onClick={() => navigate("/employer/posted-jobs")}
            >
              View All →
            </button>

          </div>


          <div className="jobs-list">

            {jobs.map((job, index) => (

              <div
                className="dashboard-job"
                key={index}
              >

                <div className="job-company-logo">
                  TC
                </div>

                <div className="dashboard-job-info">

                  <h3>{job.title}</h3>

                  <p>
                    📍 {job.location}
                  </p>

                  <div className="job-tags">
                    <span>{job.type}</span>
                    <span>{job.applicants} Applicants</span>
                  </div>

                </div>

                <div className="job-right">

                  <span
                    className={
                      job.status === "Active"
                        ? "status-active"
                        : "status-closed"
                    }
                  >
                    ● {job.status}
                  </span>

                  <small>
                    {job.date}
                  </small>

                </div>

              </div>

            ))}

          </div>

        </div>


        {/* QUICK ACTIONS */}

        <div className="dashboard-card">

          <div className="dashboard-card-header">

            <div>
              <h2>Quick Actions</h2>
              <p>Manage your employer account</p>
            </div>

          </div>


          <div className="quick-actions">

            <button
              onClick={() =>
                navigate("/employer/create-job")
              }
            >
              <span>＋</span>
              <div>
                <strong>Create Job</strong>
                <small>Post a new opening</small>
              </div>
              →
            </button>


            <button
              onClick={() =>
                navigate("/employer/company-profile")
              }
            >
              <span>🏢</span>
              <div>
                <strong>Company Profile</strong>
                <small>Update company details</small>
              </div>
              →
            </button>


            <button
              onClick={() =>
                navigate("/employer/posted-jobs")
              }
            >
              <span>📋</span>
              <div>
                <strong>Manage Jobs</strong>
                <small>View posted jobs</small>
              </div>
              →
            </button>

          </div>

        </div>

      </div>


      {/* PROFILE BANNER */}

      <div className="dashboard-banner">

        <div className="banner-icon">
          ✨
        </div>

        <div>
          <h3>Complete your company profile</h3>
          <p>
            A complete profile helps candidates trust your company
            and improves your visibility.
          </p>
        </div>

        <button
          onClick={() =>
            navigate("/employer/company-profile")
          }
        >
          Complete Profile →
        </button>

      </div>

    </div>
  );
};

export default EmployerDashboard;