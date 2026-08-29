import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import JobApplications from "./JobApplications"; // adjust path if needed

const PostedJobs = () => {
  const navigate = useNavigate();
  const [selectedJobId, setSelectedJobId] = useState(null);

  const jobs = [
    {
      id: 1,
      title: "Frontend Developer",
      location: "Mumbai, India",
      type: "Full Time",
      experience: "0 - 2 Years",
      applicants: 28,
      views: 342,
      date: "Aug 28, 2026",
      status: "Active",
    },
    {
      id: 2,
      title: "React Developer",
      location: "Remote",
      type: "Full Time",
      experience: "1 - 3 Years",
      applicants: 42,
      views: 518,
      date: "Aug 25, 2026",
      status: "Active",
    },
    {
      id: 3,
      title: "UI/UX Designer",
      location: "Mumbai, India",
      type: "Internship",
      experience: "Fresher",
      applicants: 18,
      views: 214,
      date: "Aug 20, 2026",
      status: "Closed",
    },
    {
      id: 4,
      title: "Backend Developer",
      location: "Pune, India",
      type: "Full Time",
      experience: "2 - 4 Years",
      applicants: 35,
      views: 389,
      date: "Aug 18, 2026",
      status: "Active",
    },
  ];

  return (
    <div className="posted-jobs-page">
      {/* HEADER */}

      <div className="posted-header">
        <div>
          <div className="breadcrumb">
            Employer <span>/</span> Posted Jobs
          </div>

          <h1>Posted Jobs</h1>

          <p>Manage all your job openings in one place.</p>
        </div>

        <button
          className="primary-btn"
          onClick={() => navigate("/employer/create-job")}
        >
          ＋ Create New Job
        </button>
      </div>

      {/* SUMMARY */}

      <div className="job-summary-grid">
        <div className="job-summary-card">
          <span>Total Jobs</span>
          <strong>24</strong>
          <small>All posted jobs</small>
        </div>

        <div className="job-summary-card">
          <span>Active Jobs</span>
          <strong>18</strong>
          <small>Currently hiring</small>
        </div>

        <div className="job-summary-card">
          <span>Applicants</span>
          <strong>186</strong>
          <small>Total applications</small>
        </div>

        <div className="job-summary-card">
          <span>Job Views</span>
          <strong>1,284</strong>
          <small>This month</small>
        </div>
      </div>

      {/* FILTER */}

      <div className="jobs-toolbar">
        <div className="jobs-search">
          🔍
          <input placeholder="Search jobs..." />
        </div>

        <select>
          <option>All Jobs</option>
          <option>Active</option>
          <option>Closed</option>
        </select>

        <select>
          <option>Newest First</option>
          <option>Oldest First</option>
          <option>Most Applicants</option>
        </select>
      </div>

      {/* JOB LIST */}

      <div className="posted-jobs-list">
        {jobs.map((job) => (
          <div className="posted-job-card" key={job.id}>
            <div className="posted-job-main">
              <div className="posted-company-logo">TC</div>

              <div className="posted-job-info">
                <div className="posted-job-title-row">
                  <h2>{job.title}</h2>

                  <span
                    className={
                      job.status === "Active"
                        ? "job-status active-status"
                        : "job-status closed-status"
                    }
                  >
                    ● {job.status}
                  </span>
                </div>

                <p>
                  📍 {job.location}
                  <span> • </span>
                  💼 {job.type}
                  <span> • </span>⏱ {job.experience}
                </p>

                <div className="posted-job-stats">
                  <span>
                    👥 <strong>{job.applicants}</strong> Applicants
                  </span>

                  <span>
                    👁 <strong>{job.views}</strong> Views
                  </span>

                  <span>📅 Posted {job.date}</span>
                </div>
              </div>
            </div>

            <div className="posted-job-actions">
              <button
                onClick={() => navigate(`/employer/job-preview/${job.id}`)}
              >
                👁
                <span>Preview</span>
              </button>

              <button onClick={() => navigate(`/employer/edit-job/${job.id}`)}>
                ✏<span>Edit</span>
              </button>

              <button onClick={() => setSelectedJobId(job.id)}>
                📋
                <span>Applications</span>
              </button>

              <button className="more-action">⋮</button>
            </div>
          </div>
        ))}

        {selectedJobId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-bold text-lg">Applications</h3>
                <button
                  onClick={() => setSelectedJobId(null)}
                  className="text-gray-500 hover:text-gray-800 text-xl"
                >
                  ✕
                </button>
              </div>
              <JobApplications jobId={selectedJobId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PostedJobs;
