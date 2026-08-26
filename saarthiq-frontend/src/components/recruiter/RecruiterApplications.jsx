import React, { useEffect, useState } from "react";

const RecruiterApplications = () => {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = () => {
    const storedApplications = JSON.parse(
      localStorage.getItem("appliedJobs") || "[]"
    );

    const recruiterApplications = storedApplications.map((job) => ({
      ...job,
      candidate: job.candidate || "Sandhya Dasari",
      status: job.status || "Applied",
    }));

    setApplications(recruiterApplications);
  };

  const updateStatus = (id, newStatus) => {
    const storedApplications = JSON.parse(
      localStorage.getItem("appliedJobs") || "[]"
    );

    const updatedApplications = storedApplications.map((job) =>
      String(job.id) === String(id)
        ? {
            ...job,
            status: newStatus,
          }
        : job
    );

    localStorage.setItem(
      "appliedJobs",
      JSON.stringify(updatedApplications)
    );

    setApplications(
      updatedApplications.map((job) => ({
        ...job,
        candidate: job.candidate || "Sandhya Dasari",
        status: job.status || "Applied",
      }))
    );
  };

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

  const total = applications.length;

  const appliedCount = applications.filter(
    (app) => app.status === "Applied"
  ).length;

  const shortlistedCount = applications.filter(
    (app) => app.status === "Shortlisted"
  ).length;

  const interviewCount = applications.filter(
    (app) => app.status === "Interview"
  ).length;

  const selectedCount = applications.filter(
    (app) => app.status === "Selected"
  ).length;

  const rejectedCount = applications.filter(
    (app) => app.status === "Rejected"
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Applications
          </h1>

          <p className="mt-2 text-gray-600">
            Review candidates and manage their application status.
          </p>
        </div>

        {/* Summary */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">

          {/* Total */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Total
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {total}
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
              No Applications
            </h2>

            <p className="mt-2 text-gray-500">
              No job applications have been received yet.
            </p>
          </div>
        ) : (

          /* Applications Table */
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">

            <div className="overflow-x-auto">

              <table className="w-full min-w-[900px]">

                <thead className="border-b bg-gray-50">
                  <tr>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Candidate
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Job
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Company
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Applied Date
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Status
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Update Status
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y">

                  {applications.map((application) => (
                    <tr
                      key={application.id}
                      className="hover:bg-gray-50"
                    >

                      {/* Candidate */}
                      <td className="px-6 py-5">
                        <p className="font-semibold text-gray-900">
                          {application.candidate}
                        </p>
                      </td>

                      {/* Job */}
                      <td className="px-6 py-5">
                        <p className="font-medium text-gray-900">
                          {application.title}
                        </p>
                      </td>

                      {/* Company */}
                      <td className="px-6 py-5 text-gray-600">
                        {application.company}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-5 text-gray-600">
                        {application.appliedDate}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getStatusStyle(
                            application.status
                          )}`}
                        >
                          {application.status}
                        </span>
                      </td>

                      {/* Update */}
                      <td className="px-6 py-5">

                        <select
                          value={application.status}
                          onChange={(e) =>
                            updateStatus(
                              application.id,
                              e.target.value
                            )
                          }
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        >

                          <option value="Applied">
                            Applied
                          </option>

                          <option value="Shortlisted">
                            Shortlisted
                          </option>

                          <option value="Interview">
                            Interview
                          </option>

                          <option value="Selected">
                            Selected
                          </option>

                          <option value="Rejected">
                            Rejected
                          </option>

                        </select>

                      </td>

                    </tr>
                  ))}

                </tbody>

              </table>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default RecruiterApplications;