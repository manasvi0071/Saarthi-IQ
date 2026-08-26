import React, { useState } from "react";

const JobSeekerProfile = () => {
  const [profile, setProfile] = useState({
    fullName: "Sandhya Dasari",
    email: "sandhya@example.com",
    phone: "9876543210",
    location: "Mumbai, Maharashtra",
    gender: "Female",
    headline: "Frontend Developer",
    experience: "1–3 Years",
    education: "B.Sc. Information Technology",
    skills: "React, JavaScript, HTML, CSS, Tailwind CSS",
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setProfile({
      ...profile,
      [name]: value,
    });

    setError("");
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);

    setProfile({
      ...profile,
      phone: value,
    });

    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Phone Number restriction
    if (!/^\d{10}$/.test(profile.phone)) {
      setError("Phone Number must contain exactly 10 digits.");
      return;
    }

    // Location restriction
    if (!profile.location.trim()) {
      setError("Location is required.");
      return;
    }

    setError("");
    alert("Profile updated successfully!");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            My Profile
          </h1>

          <p className="mt-2 text-gray-600">
            Manage your personal and professional information.
          </p>
        </div>

        {/* Profile Card */}
        <div className="rounded-xl bg-white p-6 shadow-sm">

          {/* Profile Header */}
          <div className="mb-8 flex items-center gap-5 border-b pb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
              SD
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {profile.fullName}
              </h2>

              <p className="text-gray-600">
                {profile.headline}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

              {/* Full Name */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Full Name
                </label>

                <input
                  type="text"
                  name="fullName"
                  value={profile.fullName}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Email
                </label>

                <input
                  type="email"
                  name="email"
                  value={profile.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Phone Number
                </label>

                <input
                  type="text"
                  name="phone"
                  value={profile.phone}
                  onChange={handlePhoneChange}
                  maxLength={10}
                  inputMode="numeric"
                  placeholder="Enter 10 digit phone number"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>

              {/* Location */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Location
                </label>

                <input
                  type="text"
                  name="location"
                  value={profile.location}
                  onChange={handleChange}
                  placeholder="e.g. Mumbai, Maharashtra"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Gender
                </label>

                <select
                  name="gender"
                  value={profile.gender}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-emerald-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              {/* Professional Headline */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Professional Headline
                </label>

                <input
                  type="text"
                  name="headline"
                  value={profile.headline}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>

              {/* Experience Dropdown */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Experience
                </label>

                <select
                  name="experience"
                  value={profile.experience}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-emerald-500"
                >
                  <option value="Fresher">Fresher</option>
                  <option value="0–1 Years">0–1 Years</option>
                  <option value="1–3 Years">1–3 Years</option>
                  <option value="3–5 Years">3–5 Years</option>
                  <option value="5+ Years">5+ Years</option>
                </select>
              </div>

              {/* Education */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Education
                </label>

                <input
                  type="text"
                  name="education"
                  value={profile.education}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>

              {/* Skills */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Skills
                </label>

                <input
                  type="text"
                  name="skills"
                  value={profile.skills}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>

            </div>

            {/* Save Button */}
            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700"
              >
                Save Profile
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default JobSeekerProfile;