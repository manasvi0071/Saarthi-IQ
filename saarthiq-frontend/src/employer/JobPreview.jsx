import React from "react";
import { useNavigate, useParams } from "react-router-dom";

const JobPreview = () => {

  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <div className="preview-page">

      {/* HEADER */}

      <div className="preview-header">

        <div>

          <div className="breadcrumb">
            Employer <span>/</span> Job Preview
          </div>

          <h1>Job Preview</h1>

          <p>
            This is how your job will appear to candidates.
          </p>

        </div>

        <div className="preview-actions">

          <button
            className="secondary-btn"
            onClick={() =>
              navigate(`/employer/edit-job/${id}`)
            }
          >
            ✏ Edit Job
          </button>

          <button
            className="primary-btn"
            onClick={() =>
              alert("Job published successfully!")
            }
          >
            🚀 Publish Job
          </button>

        </div>

      </div>


      {/* JOB PREVIEW */}

      <div className="job-preview-layout">

        <div className="job-preview-main">

          <div className="preview-job-header">

            <div className="preview-company-logo">
              TC
            </div>

            <div>

              <h2>Frontend Developer</h2>

              <p>
                Talent Corner HR Services
              </p>

              <div className="preview-job-tags">

                <span>📍 Mumbai, India</span>

                <span>💼 Full Time</span>

                <span>⏱ 0 - 2 Years</span>

              </div>

            </div>

          </div>


          <div className="preview-section">

            <h3>About the Job</h3>

            <p>
              We are looking for a talented Frontend Developer
              to join our growing team. You will work with our
              development team to build modern and responsive
              web applications.
            </p>

          </div>


          <div className="preview-section">

            <h3>Responsibilities</h3>

            <ul>
              <li>Develop responsive web applications.</li>
              <li>Work closely with the development team.</li>
              <li>Write clean and reusable code.</li>
              <li>Optimize applications for performance.</li>
              <li>Participate in code reviews.</li>
            </ul>

          </div>


          <div className="preview-section">

            <h3>Required Qualifications</h3>

            <ul>
              <li>Bachelor's degree in IT or related field.</li>
              <li>Good knowledge of JavaScript and React.</li>
              <li>Strong problem-solving skills.</li>
              <li>Good communication skills.</li>
            </ul>

          </div>


          <div className="preview-section">

            <h3>Required Skills</h3>

            <div className="skill-list">

              <span>React</span>
              <span>JavaScript</span>
              <span>HTML</span>
              <span>CSS</span>
              <span>Git</span>

            </div>

          </div>

        </div>


        {/* RIGHT */}

        <div className="preview-sidebar">

          <div className="preview-side-card">

            <h3>Job Overview</h3>

            <div className="overview-item">
              <span>💼 Job Type</span>
              <strong>Full Time</strong>
            </div>

            <div className="overview-item">
              <span>📍 Location</span>
              <strong>Mumbai, India</strong>
            </div>

            <div className="overview-item">
              <span>💰 Salary</span>
              <strong>₹4 - ₹7 LPA</strong>
            </div>

            <div className="overview-item">
              <span>⏱ Experience</span>
              <strong>0 - 2 Years</strong>
            </div>

          </div>


          <div className="preview-side-card company-preview-card">

            <h3>About the Company</h3>

            <div className="company-preview-mini">

              <div className="preview-small-logo">
                TC
              </div>

              <div>
                <strong>
                  Talent Corner HR Services
                </strong>

                <span>
                  Recruitment & Staffing
                </span>
              </div>

            </div>

            <p>
              Connecting talented people with great
              opportunities.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
};

export default JobPreview;