import React, { useEffect, useState } from "react";

const AppliedJobs = () => {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    const storedApplications = localStorage.getItem("appliedJobs");

    if (storedApplications) {
      setApplications(JSON.parse(storedApplications));
    }
  }, []);

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

  const appliedCount = applications.filter(
    (job) => job.status === "Applied"
  ).length;

  const shortlistedCount = applications.filter(
    (job) => job.status === "Shortlisted"
  ).length;

  const interviewCount = applications.filter(
    (job) => job.status === "Interview"
  ).length;

  const selectedCount = applications.filter(
    (job) => job.status === "Selected"
  ).length;

  const rejectedCount = applications.filter(
    (job) => job.status === "Rejected"
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Applied Jobs
          </h1>

          <p className="mt-2 text-gray-600">
            Track the jobs you have applied for and monitor your application status.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">

          {/* Total */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Applications
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {applications.length}
            </p>
          </div>

          {/* Applied */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Applied
            </p>

            <p className="mt-2 text-2xl font-bold text-blue-600">
              {appliedCount}
            </p>
          </div>

          {/* Shortlisted */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Shortlisted
            </p>

            <p className="mt-2 text-2xl font-bold text-yellow-600">
              {shortlistedCount}
            </p>
          </div>

          {/* Interview */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Interview
            </p>

            <p className="mt-2 text-2xl font-bold text-purple-600">
              {interviewCount}
            </p>
          </div>

          {/* Selected */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Selected
            </p>

            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {selectedCount}
            </p>
          </div>

          {/* Rejected */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Rejected
            </p>

            <p className="mt-2 text-2xl font-bold text-red-600">
              {rejectedCount}
            </p>
          </div>

        </div>

        {/* No Applications */}
        {applications.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">

            <div className="text-5xl">
              📋
            </div>

            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              No Applied Jobs
            </h2>

            <p className="mt-2 text-gray-500">
              You have not applied for any jobs yet.
            </p>

          </div>
        ) : (

          /* Applications */
          <div className="space-y-5">

            {applications.map((job) => (
              <div
                key={job.id}
                className="rounded-xl bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">

                  {/* Job Information */}
                  <div className="flex gap-4">

                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-lg font-bold text-emerald-700">
                      {job.company.charAt(0)}
                    </div>

                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {job.title}
                      </h2>

                      <p className="mt-1 font-medium text-emerald-600">
                        {job.company}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
                        <span>
                          📍 {job.location}
                        </span>

                        <span>
                          📅 Applied on {job.appliedDate}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-gray-500">
                        💼 {job.type}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        💰 {job.salary}
                      </p>
                    </div>

                  </div>

                  {/* Status */}
                  <div>
                    <span
                      className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${getStatusStyle(
                        job.status
                      )}`}
                    >
                      {job.status}
                    </span>
                  </div>

                </div>
              </div>
            ))}

          </div>
        )}

      </div>
    </div>
  );
};

export default AppliedJobs;