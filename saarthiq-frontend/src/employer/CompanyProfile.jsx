import React, { useState } from "react";

const CompanyProfile = () => {
  const [logo, setLogo] = useState(null);

  const [company, setCompany] = useState({
    name: "Talent Corner HR Services",
    tagline: "Connecting talented people with great opportunities.",
    industry: "Recruitment & Staffing",
    location: "Mumbai, Maharashtra, India",
    website: "https://www.talentcorner.in",
    employees: "50 - 100",
    email: "hr@talentcorner.in",
    phone: "+91 98765 43210",
    about:
      "Talent Corner HR Services is focused on helping organizations find skilled professionals and helping candidates discover meaningful career opportunities."
  });

  const [saved, setSaved] = useState(false);

  const handleLogoChange = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Logo size should be less than 2MB.");
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    setLogo(imageUrl);
  };

  const removeLogo = () => {
    setLogo(null);
  };

  const handleChange = (e) => {
    setCompany({
      ...company,
      [e.target.name]: e.target.value
    });

    setSaved(false);
  };

  const handleSave = (e) => {
    e.preventDefault();

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2500);
  };

  return (
    <div className="company-page">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="company-page-header">

        <div>
          <div className="breadcrumb">
            Employer <span>/</span> Company Profile
          </div>

          <h1>Company Profile</h1>

          <p>
            Manage your company information and public profile.
          </p>
        </div>

        <div className="header-actions">

          {saved && (
            <div className="save-message">
              ✓ Changes saved
            </div>
          )}

          <button
            className="profile-save-btn"
            onClick={handleSave}
          >
            💾 Save Changes
          </button>

        </div>

      </div>


      {/* =====================================================
          PROFILE COVER
      ===================================================== */}

      <div className="company-cover-card">

        <div className="company-cover-bg">

          <div className="cover-pattern pattern-one"></div>
          <div className="cover-pattern pattern-two"></div>
          <div className="cover-pattern pattern-three"></div>

          <div className="cover-content">

            <span className="cover-badge">
              ✨ COMPANY PROFILE
            </span>

            <h2>Build your company presence</h2>

            <p>
              Make your company profile attractive to talented candidates.
            </p>

          </div>

        </div>


        {/* =====================================================
            LOGO AREA
        ===================================================== */}

        <div className="company-logo-section">

          <div className="logo-wrapper">

            <label
              className="company-logo-box"
              title="Upload company logo"
            >

              {logo ? (
                <img
                  src={logo}
                  alt="Company Logo"
                />
              ) : (
                <div className="default-company-logo">
                  <span>TC</span>
                </div>
              )}

              <div className="logo-camera">
                📷
              </div>

              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleLogoChange}
                hidden
              />

            </label>

            {logo && (
              <button
                className="remove-logo-btn"
                onClick={removeLogo}
                type="button"
              >
                🗑 Remove
              </button>
            )}

          </div>


          <div className="company-main-info">

            <h2>{company.name}</h2>

            <p>
              {company.tagline}
            </p>

            <div className="company-mini-details">

              <span>
                📍 {company.location}
              </span>

              <span>
                🏢 {company.industry}
              </span>

              <span>
                👥 {company.employees} employees
              </span>

            </div>

          </div>

        </div>

      </div>


      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <form
        className="company-content-grid"
        onSubmit={handleSave}
      >

        {/* =====================================================
            LEFT SIDE
        ===================================================== */}

        <div className="company-left-column">


          {/* BASIC INFORMATION */}

          <div className="profile-card">

            <div className="card-heading">

              <div className="heading-icon purple-icon">
                🏢
              </div>

              <div>
                <h3>Basic Information</h3>

                <p>
                  Tell candidates about your company.
                </p>
              </div>

            </div>


            <div className="form-grid">

              <div className="profile-field full-field">

                <label>
                  Company Name
                </label>

                <input
                  name="name"
                  value={company.name}
                  onChange={handleChange}
                  placeholder="Enter company name"
                />

              </div>


              <div className="profile-field full-field">

                <label>
                  Company Tagline
                </label>

                <input
                  name="tagline"
                  value={company.tagline}
                  onChange={handleChange}
                  placeholder="Short company tagline"
                />

              </div>


              <div className="profile-field">

                <label>
                  Industry
                </label>

                <select
                  name="industry"
                  value={company.industry}
                  onChange={handleChange}
                >
                  <option>Recruitment & Staffing</option>
                  <option>Information Technology</option>
                  <option>Software Development</option>
                  <option>Finance</option>
                  <option>Marketing</option>
                  <option>Education</option>
                  <option>Healthcare</option>
                  <option>Other</option>
                </select>

              </div>


              <div className="profile-field">

                <label>
                  Company Size
                </label>

                <select
                  name="employees"
                  value={company.employees}
                  onChange={handleChange}
                >
                  <option>1 - 10</option>
                  <option>11 - 50</option>
                  <option>50 - 100</option>
                  <option>100 - 500</option>
                  <option>500 - 1000</option>
                  <option>1000+</option>
                </select>

              </div>


              <div className="profile-field full-field">

                <label>
                  Location
                </label>

                <div className="input-with-icon">

                  <span>📍</span>

                  <input
                    name="location"
                    value={company.location}
                    onChange={handleChange}
                    placeholder="Company location"
                  />

                </div>

              </div>

            </div>

          </div>


          {/* ABOUT COMPANY */}

          <div className="profile-card">

            <div className="card-heading">

              <div className="heading-icon blue-icon">
                📝
              </div>

              <div>
                <h3>About Company</h3>

                <p>
                  Give candidates a better understanding of your company.
                </p>
              </div>

            </div>


            <div className="profile-field">

              <label>
                Company Description
              </label>

              <textarea
                name="about"
                value={company.about}
                onChange={handleChange}
                placeholder="Write something about your company..."
                rows="7"
              />

              <div className="character-count">
                {company.about.length} / 500 characters
              </div>

            </div>

          </div>

        </div>


        {/* =====================================================
            RIGHT SIDE
        ===================================================== */}

        <div className="company-right-column">


          {/* CONTACT INFORMATION */}

          <div className="profile-card">

            <div className="card-heading">

              <div className="heading-icon green-icon">
                📞
              </div>

              <div>
                <h3>Contact Information</h3>

                <p>
                  How candidates can reach you.
                </p>
              </div>

            </div>


            <div className="profile-field">

              <label>
                Business Email
              </label>

              <div className="input-with-icon">

                <span>✉️</span>

                <input
                  type="email"
                  name="email"
                  value={company.email}
                  onChange={handleChange}
                />

              </div>

            </div>


            <div className="profile-field">

              <label>
                Phone Number
              </label>

              <div className="input-with-icon">

                <span>📱</span>

                <input
                  type="text"
                  name="phone"
                  value={company.phone}
                  onChange={handleChange}
                />

              </div>

            </div>


            <div className="profile-field">

              <label>
                Company Website
              </label>

              <div className="input-with-icon">

                <span>🌐</span>

                <input
                  type="url"
                  name="website"
                  value={company.website}
                  onChange={handleChange}
                />

              </div>

            </div>

          </div>


          {/* PROFILE COMPLETION */}

          <div className="completion-card">

            <div className="completion-top">

              <div>
                <span>Profile Completion</span>

                <strong>85%</strong>
              </div>

              <div className="completion-circle">
                ✓
              </div>

            </div>

            <div className="progress-bar">

              <div
                className="progress-fill"
                style={{
                  width: "85%"
                }}
              ></div>

            </div>

            <p>
              Your profile looks great! Add a few more details
              to make it complete.
            </p>

          </div>


          {/* LOGO TIP */}

          <div className="logo-tip-card">

            <div className="tip-icon">
              💡
            </div>

            <div>

              <h4>Logo Tip</h4>

              <p>
                Use a clear square logo with a transparent or
                white background.
              </p>

              <small>
                PNG, JPG or WEBP • Max 2MB
              </small>

            </div>

          </div>

        </div>

      </form>

    </div>
  );
};

export default CompanyProfile;