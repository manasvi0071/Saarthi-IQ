import React, { useEffect, useState } from "react";

const SavedJobs = () => {
  const [savedJobs, setSavedJobs] = useState([]);

  useEffect(() => {
    const storedJobs = localStorage.getItem("savedJobs");

    if (storedJobs) {
      setSavedJobs(JSON.parse(storedJobs));
    }
  }, []);

  const removeSavedJob = (jobId) => {
    const updatedJobs = savedJobs.filter((job) => job.id !== jobId);

    setSavedJobs(updatedJobs);
    localStorage.setItem("savedJobs", JSON.stringify(updatedJobs));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Saved Jobs
          </h1>

          <p className="mt-2 text-gray-600">
            View and manage the jobs you have saved.
          </p>
        </div>

        {savedJobs.length > 0 ? (
          <div className="space-y-5">
            {savedJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-5 md:flex-row">

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

                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-gray-600">
                        <span>📍 {job.location}</span>
                        <span>•</span>
                        <span>💼 {job.type}</span>
                        <span>•</span>
                        <span>💰 {job.salary}</span>
                      </div>

                      <p className="mt-3 text-sm text-gray-500">
                        Skills: {job.skills}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">

                    <button
                      type="button"
                      onClick={() => removeSavedJob(job.id)}
                      className="rounded-lg border border-red-300 px-5 py-2.5 font-medium text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        alert(`Application started for ${job.title}`)
                      }
                      className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700"
                    >
                      Apply Now
                    </button>

                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-white p-10 text-center shadow-sm">

            <div className="text-5xl">
              ♡
            </div>

            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              No Saved Jobs
            </h2>

            <p className="mt-2 text-gray-500">
              You have not saved any jobs yet.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default SavedJobs;