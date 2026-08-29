import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const EditJob = () => {

  const navigate = useNavigate();
  const { id } = useParams();

  const [job, setJob] = useState({
    title: "Frontend Developer",
    department: "Engineering",
    location: "Mumbai, India",
    type: "Full Time",
    experience: "0 - 2 Years",
    salary: "₹4 LPA - ₹7 LPA",
    skills: "React, JavaScript, HTML, CSS",
    description:
      "We are looking for a talented Frontend Developer to join our growing team.",
    responsibilities:
      "Develop responsive applications.\nWork with the development team.\nWrite clean and reusable code.",
    qualifications:
      "Bachelor's degree in IT or related field.\nGood communication skills."
  });

  const handleChange = (e) => {
    setJob({
      ...job,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    alert("Job updated successfully!");

    navigate("/employer/posted-jobs");
  };

  return (
    <div className="job-page">

      <div className="job-page-header">

        <div>

          <div className="breadcrumb">
            Employer <span>/</span> Edit Job
          </div>

          <h1>Edit Job</h1>

          <p>
            Update the details of your job posting.
          </p>

        </div>

        <span className="edit-job-id">
          Job ID: #{id}
        </span>

      </div>


      <form onSubmit={handleSubmit}>

        <div className="job-form-card">

          <div className="form-card-heading">

            <div className="form-heading-icon">
              ✏️
            </div>

            <div>
              <h2>Job Information</h2>
              <p>Update your job details.</p>
            </div>

          </div>


          <div className="form-grid">

            <div className="profile-field full-field">

              <label>Job Title *</label>

              <input
                name="title"
                value={job.title}
                onChange={handleChange}
                required
              />

            </div>


            <div className="profile-field">

              <label>Department</label>

              <input
                name="department"
                value={job.department}
                onChange={handleChange}
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
              </select>

            </div>


            <div className="profile-field">

              <label>Location</label>

              <input
                name="location"
                value={job.location}
                onChange={handleChange}
              />

            </div>


            <div className="profile-field">

              <label>Experience</label>

              <select
                name="experience"
                value={job.experience}
                onChange={handleChange}
              >
                <option>Fresher</option>
                <option>0 - 2 Years</option>
                <option>2 - 4 Years</option>
                <option>4 - 7 Years</option>
                <option>7+ Years</option>
              </select>

            </div>


            <div className="profile-field full-field">

              <label>Salary</label>

              <input
                name="salary"
                value={job.salary}
                onChange={handleChange}
              />

            </div>


            <div className="profile-field full-field">

              <label>Required Skills</label>

              <input
                name="skills"
                value={job.skills}
                onChange={handleChange}
              />

            </div>

          </div>

        </div>


        <div className="job-form-card">

          <div className="form-card-heading">

            <div className="form-heading-icon blue-form-icon">
              📝
            </div>

            <div>
              <h2>Job Description</h2>
              <p>Update the description and requirements.</p>
            </div>

          </div>


          <div className="profile-field">

            <label>Description</label>

            <textarea
              name="description"
              value={job.description}
              onChange={handleChange}
              rows="6"
            />

          </div>


          <div className="profile-field">

            <label>Responsibilities</label>

            <textarea
              name="responsibilities"
              value={job.responsibilities}
              onChange={handleChange}
              rows="6"
            />

          </div>


          <div className="profile-field">

            <label>Qualifications</label>

            <textarea
              name="qualifications"
              value={job.qualifications}
              onChange={handleChange}
              rows="5"
            />

          </div>

        </div>


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
            ✓ Update Job
          </button>

        </div>

      </form>

    </div>
  );
};

export default EditJob;