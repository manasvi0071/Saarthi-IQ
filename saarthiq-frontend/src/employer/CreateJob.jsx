import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const CreateJob = () => {

  const navigate = useNavigate();

  const [job, setJob] = useState({
    title: "",
    department: "",
    location: "",
    type: "Full Time",
    experience: "",
    salary: "",
    skills: "",
    description: "",
    responsibilities: "",
    qualifications: ""
  });

  const handleChange = (e) => {
    setJob({
      ...job,
      [e.target.name]: e.target.value
    });
  };

  const handlePreview = (e) => {
    e.preventDefault();

    navigate("/employer/job-preview/new");
  };

  return (
    <div className="job-page">

      {/* HEADER */}

      <div className="job-page-header">

        <div>
          <div className="breadcrumb">
            Employer <span>/</span> Create Job
          </div>

          <h1>Create New Job</h1>

          <p>
            Create a job opening and find the right candidates.
          </p>
        </div>

        <button
          className="secondary-btn"
          onClick={() =>
            navigate("/employer/posted-jobs")
          }
        >
          Cancel
        </button>

      </div>


      <form onSubmit={handlePreview}>

        {/* BASIC INFO */}

        <div className="job-form-card">

          <div className="form-card-heading">

            <div className="form-heading-icon">
              💼
            </div>

            <div>
              <h2>Job Information</h2>
              <p>Enter the basic details about this position.</p>
            </div>

          </div>


          <div className="form-grid">

            <div className="profile-field full-field">
              <label>Job Title *</label>

              <input
                name="title"
                value={job.title}
                onChange={handleChange}
                placeholder="e.g. Frontend Developer"
                required
              />
            </div>


            <div className="profile-field">
              <label>Department</label>

              <input
                name="department"
                value={job.department}
                onChange={handleChange}
                placeholder="e.g. Engineering"
              />
            </div>


            <div className="profile-field">
              <label>Job Type</label>

              <select
                name="type"
                value={job.type}
                onChange={handleChange}
              >
                <option>Full Time</option>
                <option>Part Time</option>
                <option>Internship</option>
                <option>Contract</option>
                <option>Freelance</option>
              </select>
            </div>


            <div className="profile-field">
              <label>Location</label>

              <input
                name="location"
                value={job.location}
                onChange={handleChange}
                placeholder="e.g. Mumbai / Remote"
              />
            </div>


            <div className="profile-field">
              <label>Experience</label>

              <select
                name="experience"
                value={job.experience}
                onChange={handleChange}
              >
                <option value="">Select experience</option>
                <option>Fresher</option>
                <option>0 - 2 Years</option>
                <option>2 - 4 Years</option>
                <option>4 - 7 Years</option>
                <option>7+ Years</option>
              </select>
            </div>


            <div className="profile-field full-field">
              <label>Salary Range</label>

              <input
                name="salary"
                value={job.salary}
                onChange={handleChange}
                placeholder="e.g. ₹4 LPA - ₹7 LPA"
              />
            </div>


            <div className="profile-field full-field">
              <label>Required Skills</label>

              <input
                name="skills"
                value={job.skills}
                onChange={handleChange}
                placeholder="React, JavaScript, HTML, CSS..."
              />
            </div>

          </div>

        </div>


        {/* DESCRIPTION */}

        <div className="job-form-card">

          <div className="form-card-heading">

            <div className="form-heading-icon blue-form-icon">
              📝
            </div>

            <div>
              <h2>Job Description</h2>
              <p>Describe the opportunity for candidates.</p>
            </div>

          </div>


          <div className="profile-field">

            <label>Job Description *</label>

            <textarea
              name="description"
              value={job.description}
              onChange={handleChange}
              placeholder="Write a detailed description of the role..."
              rows="7"
              required
            />

          </div>


          <div className="profile-field">

            <label>Responsibilities</label>

            <textarea
              name="responsibilities"
              value={job.responsibilities}
              onChange={handleChange}
              placeholder="• Develop and maintain applications&#10;• Work with the development team&#10;• Write clean and reusable code"
              rows="6"
            />

          </div>


          <div className="profile-field">

            <label>Qualifications</label>

            <textarea
              name="qualifications"
              value={job.qualifications}
              onChange={handleChange}
              placeholder="• Bachelor's degree&#10;• Good communication skills&#10;• Strong technical knowledge"
              rows="6"
            />

          </div>

        </div>


        {/* ACTIONS */}

        <div className="job-form-actions">

          <button
            type="button"
            className="secondary-btn"
            onClick={() =>
              navigate("/employer/posted-jobs")
            }
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-btn"
          >
            👁 Preview Job →
          </button>

        </div>

      </form>

    </div>
  );
};

export default CreateJob;