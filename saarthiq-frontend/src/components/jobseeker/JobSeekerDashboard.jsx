import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const JobSeekerDashboard = () => {
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [savedJobsCount, setSavedJobsCount] = useState(0);

  useEffect(() => {
    const loadDashboardData = () => {
      // Applied Jobs
      const storedApplications = localStorage.getItem("appliedJobs");

      if (storedApplications) {
        try {
          setApplications(JSON.parse(storedApplications));
        } catch (error) {
          console.error("Error reading appliedJobs:", error);
          setApplications([]);
        }
      } else {
        setApplications([]);
      }

      // Saved Jobs
      const storedSavedJobs = localStorage.getItem("savedJobs");

      if (storedSavedJobs) {
        try {
          setSavedJobsCount(JSON.parse(storedSavedJobs).length);
        } catch (error) {
          console.error("Error reading savedJobs:", error);
          setSavedJobsCount(0);
        }
      } else {
        setSavedJobsCount(0);
      }
    };

    loadDashboardData();

    // Dashboard refresh jab localStorage change ho
    window.addEventListener("storage", loadDashboardData);

    return () => {
      window.removeEventListener("storage", loadDashboardData);
    };
  }, []);

  const getCount = (status) => {
    return applications.filter(
      (job) => job.status === status
    ).length;
  };

  const appliedCount = getCount("Applied");
  const shortlistedCount = getCount("Shortlisted");
  const interviewCount = getCount("Interview");
  const selectedCount = getCount("Selected");
  const rejectedCount = getCount("Rejected");

  const interviewCountForCard = interviewCount;

  const recentApplications = [...applications]
    .reverse()
    .slice(0, 3);

  const getStatusStyle = (status) => {
    switch (status) {
      case "Applied":
        return "bg-blue-100 text-blue-700";

      case "Shortlisted":
        return "bg-yellow-100 text-yellow-700";

      case "Interview":
        return "bg-purple-100 text-purple-700";

      case "Selected":
        return "bg-emerald-100 text-emerald-700";

      case "Rejected":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Job Seeker Dashboard
          </h1>

          <p className="mt-2 text-gray-600">
            Welcome back! Here is your job search overview.
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">

          {/* Total Applications */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Total Applications
            </p>

            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              {applications.length}
            </h2>

            <p className="mt-2 text-sm text-blue-600">
              Applications submitted
            </p>
          </div>

          {/* Saved Jobs */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Saved Jobs
            </p>

            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              {savedJobsCount}
            </h2>

            <p className="mt-2 text-sm text-emerald-600">
              Jobs saved for later
            </p>
          </div>

          {/* Interviews */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Interviews
            </p>

            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              {interviewCountForCard}
            </h2>

            <p className="mt-2 text-sm text-purple-600">
              Upcoming interviews
            </p>
          </div>

          {/* Profile Completion */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Profile Completion
            </p>

            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              85%
            </h2>

            <p className="mt-2 text-sm text-orange-600">
              Complete your profile
            </p>
          </div>

        </div>

        {/* Application Status */}
        <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">

          <h2 className="text-xl font-bold text-gray-900">
            Application Status
          </h2>

          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-5">

            {/* Applied */}
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-gray-600">
                Applied
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-600">
                {appliedCount}
              </p>
            </div>

            {/* Shortlisted */}
            <div className="rounded-lg bg-yellow-50 p-4">
              <p className="text-sm text-gray-600">
                Shortlisted
              </p>

              <p className="mt-1 text-2xl font-bold text-yellow-600">
                {shortlistedCount}
              </p>
            </div>

            {/* Interview */}
            <div className="rounded-lg bg-purple-50 p-4">
              <p className="text-sm text-gray-600">
                Interview
              </p>

              <p className="mt-1 text-2xl font-bold text-purple-600">
                {interviewCount}
              </p>
            </div>

            {/* Selected */}
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-sm text-gray-600">
                Selected
              </p>

              <p className="mt-1 text-2xl font-bold text-green-600">
                {selectedCount}
              </p>
            </div>

            {/* Rejected */}
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-sm text-gray-600">
                Rejected
              </p>

              <p className="mt-1 text-2xl font-bold text-red-600">
                {rejectedCount}
              </p>
            </div>

          </div>
        </div>

        {/* Recent Applications */}
        <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">

          <div className="flex items-center justify-between">

            <h2 className="text-xl font-bold text-gray-900">
              Recent Applications
            </h2>

            <button
              type="button"
              onClick={() => navigate("/applied-jobs")}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              View All
            </button>

          </div>

          <div className="mt-5 overflow-x-auto">

            {recentApplications.length === 0 ? (

              <div className="rounded-lg bg-gray-50 p-8 text-center">
                <p className="text-gray-500">
                  No applications yet.
                </p>

                <button
                  type="button"
                  onClick={() => navigate("/job-board")}
                  className="mt-4 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Find Jobs
                </button>
              </div>

            ) : (

              <table className="w-full text-left">

                <thead>
                  <tr className="border-b text-sm text-gray-500">

                    <th className="px-4 py-3">
                      Job
                    </th>

                    <th className="px-4 py-3">
                      Company
                    </th>

                    <th className="px-4 py-3">
                      Applied On
                    </th>

                    <th className="px-4 py-3">
                      Status
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {recentApplications.map((job) => (

                    <tr
                      key={job.id}
                      className="border-b last:border-b-0"
                    >

                      <td className="px-4 py-4 font-medium text-gray-900">
                        {job.title}
                      </td>

                      <td className="px-4 py-4 text-gray-600">
                        {job.company}
                      </td>

                      <td className="px-4 py-4 text-gray-600">
                        {job.appliedDate || "26 Aug 2026"}
                      </td>

                      <td className="px-4 py-4">

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(
                            job.status
                          )}`}
                        >
                          {job.status || "Applied"}
                        </span>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            )}

          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">

          {/* Find Jobs */}
          <button
            type="button"
            onClick={() => navigate("/job-board")}
            className="rounded-xl bg-emerald-600 p-5 text-left text-white shadow-sm hover:bg-emerald-700"
          >
            <h3 className="font-semibold">
              Find Jobs
            </h3>

            <p className="mt-1 text-sm text-emerald-100">
              Explore available job opportunities
            </p>
          </button>

          {/* Update Resume */}
          <button
            type="button"
            onClick={() => navigate("/resume-management")}
            className="rounded-xl bg-white p-5 text-left shadow-sm hover:bg-gray-50"
          >
            <h3 className="font-semibold text-gray-900">
              Update Resume
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Upload or update your latest resume
            </p>
          </button>

          {/* Edit Profile */}
          <button
            type="button"
            onClick={() => navigate("/job-seeker-profile")}
            className="rounded-xl bg-white p-5 text-left shadow-sm hover:bg-gray-50"
          >
            <h3 className="font-semibold text-gray-900">
              Edit Profile
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Keep your profile information updated
            </p>
          </button>

        </div>

      </div>
    </div>
  );
};

export default JobSeekerDashboard;