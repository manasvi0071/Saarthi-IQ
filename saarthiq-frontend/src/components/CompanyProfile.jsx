import React, { useEffect, useState } from "react";
import { Save, Upload, Building2 } from "lucide-react";
import {
  getCompanyProfile,
  updateCompanyProfile,
} from "../employer/employerApi";

const countries = [
  { name: "India", code: "+91" },
  { name: "United States", code: "+1" },
  { name: "United Kingdom", code: "+44" },
  { name: "Canada", code: "+1" },
  { name: "Australia", code: "+61" },
  { name: "United Arab Emirates", code: "+971" },
  { name: "Singapore", code: "+65" },
  { name: "Germany", code: "+49" },
  { name: "France", code: "+33" },
  { name: "Japan", code: "+81" },
  { name: "China", code: "+86" },
  { name: "Nepal", code: "+977" },
  { name: "Bangladesh", code: "+880" },
  { name: "Sri Lanka", code: "+94" },
  { name: "South Africa", code: "+27" },
];

const CompanyProfile = () => {
  const [form, setForm] = useState({
    company_name: "",
    email: "",
    country_code: "+91",
    phone: "",
    website: "",
    industry: "",
    company_size: "",
    location: "",
    description: "",
  });

  const [logo, setLogo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadCompany();
  }, []);

  const loadCompany = async () => {
    try {
      const response = await getCompanyProfile();

      const data =
        response.data?.data ||
        response.data?.company ||
        response.data;

      if (data) {
        setForm((previous) => ({
          ...previous,
          ...data,
          phone: String(
            data.phone || ""
          ).replace(/\D/g, "").slice(-10),
          country_code:
            data.country_code || "+91",
        }));
      }
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          "Unable to load company profile."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "phone") {
      const digits = value
        .replace(/\D/g, "")
        .slice(0, 10);

      setForm((previous) => ({
        ...previous,
        phone: digits,
      }));

      return;
    }

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!form.company_name.trim()) {
      setError("Company name is required.");
      return;
    }

    if (!form.email.trim()) {
      setError("Company email is required.");
      return;
    }

    if (form.phone.length !== 10) {
      setError(
        "Phone number must contain exactly 10 digits."
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,
        phone: form.phone,
        country_code: form.country_code,
      };

      await updateCompanyProfile(payload);

      setMessage(
        "Company profile updated successfully."
      );
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          "Unable to update company profile."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        Loading company information...
      </div>
    );
  }

  return (
    <div className="employer-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            COMPANY
          </span>

          <h1>Company Profile</h1>

          <p>
            Keep your company information accurate
            for candidates.
          </p>
        </div>
      </div>

      {error && (
        <div className="api-error">
          {error}
        </div>
      )}

      {message && (
        <div className="success-message">
          {message}
        </div>
      )}

      <form
        className="profile-card"
        onSubmit={handleSave}
      >
        <div className="profile-logo-section">
          <div className="profile-logo">
            {logo ? (
              <img
                src={URL.createObjectURL(logo)}
                alt="Company logo"
              />
            ) : (
              <Building2 size={38} />
            )}
          </div>

          <div>
            <h3>Company Logo</h3>

            <p>
              Upload your company logo.
            </p>

            <label className="upload-button">
              <Upload size={17} />
              Choose Logo

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) =>
                  setLogo(e.target.files?.[0] || null)
                }
                hidden
              />
            </label>
          </div>
        </div>

        <div className="form-divider" />

        <div className="form-grid">
          <div className="form-group">
            <label>
              Company Name <span>*</span>
            </label>

            <input
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              required
              maxLength={100}
              placeholder="Enter company name"
            />
          </div>

          <div className="form-group">
            <label>
              Company Email <span>*</span>
            </label>

            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              maxLength={150}
              placeholder="company@example.com"
            />
          </div>

          <div className="form-group phone-group">
            <label>
              Phone Number <span>*</span>
            </label>

            <div className="phone-input">
              <select
                name="country_code"
                value={form.country_code}
                onChange={handleChange}
              >
                {countries.map((country) => (
                  <option
                    key={`${country.name}-${country.code}`}
                    value={country.code}
                  >
                    {country.name} ({country.code})
                  </option>
                ))}
              </select>

              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                inputMode="numeric"
                maxLength={10}
                pattern="[0-9]{10}"
                placeholder="10 digit number"
              />
            </div>

            <small>
              Enter exactly 10 digits.
            </small>
          </div>

          <div className="form-group">
            <label>Website</label>

            <input
              type="url"
              name="website"
              value={form.website}
              onChange={handleChange}
              maxLength={200}
              placeholder="https://company.com"
            />
          </div>

          <div className="form-group">
            <label>Industry</label>

            <input
              name="industry"
              value={form.industry}
              onChange={handleChange}
              maxLength={100}
              placeholder="Information Technology"
            />
          </div>

          <div className="form-group">
            <label>Company Size</label>

            <select
              name="company_size"
              value={form.company_size}
              onChange={handleChange}
            >
              <option value="">
                Select company size
              </option>
              <option value="1-10">1–10</option>
              <option value="11-50">11–50</option>
              <option value="51-200">51–200</option>
              <option value="201-500">201–500</option>
              <option value="501-1000">501–1000</option>
              <option value="1000+">1000+</option>
            </select>
          </div>

          <div className="form-group full-width">
            <label>Location</label>

            <input
              name="location"
              value={form.location}
              onChange={handleChange}
              maxLength={150}
              placeholder="Company location"
            />
          </div>

          <div className="form-group full-width">
            <label>Company Description</label>

            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              maxLength={1000}
              rows={6}
              placeholder="Tell candidates about your company..."
            />

            <small>
              Maximum 1000 characters.
            </small>
          </div>
        </div>

        <div className="form-footer">
          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            <Save size={18} />

            {saving
              ? "Saving..."
              : "Save Company Profile"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CompanyProfile;