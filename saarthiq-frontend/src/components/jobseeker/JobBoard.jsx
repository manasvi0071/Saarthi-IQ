import React, { useEffect, useState } from "react";

const JobBoard = () => {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [savedJobs, setSavedJobs] = useState([]);
  const [appliedJobs, setAppliedJobs] = useState([]);

  const jobs = [
    {
      id: 1,
      title: "Frontend Developer",
      company: "TCS",
      location: "Mumbai, Maharashtra",
      salary: "₹4 - ₹6 LPA",
      type: "Full Time",
      skills: "React, JavaScript, HTML, CSS",
    },
    {
      id: 2,
      title: "React Developer",
      company: "Infosys",
      location: "Pune, Maharashtra",
      salary: "₹5 - ₹8 LPA",
      type: "Full Time",
      skills: "React, JavaScript, Tailwind CSS",
    },
    {
      id: 3,
      title: "Web Developer",
      company: "Wipro",
      location: "Bangalore, Karnataka",
      salary: "₹3 - ₹5 LPA",
      type: "Full Time",
      skills: "HTML, CSS, JavaScript",
    },
    {
      id: 4,
      title: "Junior Software Developer",
      company: "Accenture",
      location: "Mumbai, Maharashtra",
      salary: "₹4 - ₹7 LPA",
      type: "Full Time",
      skills: "JavaScript, React, Git",
    },
  ];

  useEffect(() => {
    const storedSavedJobs = localStorage.getItem("savedJobs");
    const storedAppliedJobs = localStorage.getItem("appliedJobs");

    if (storedSavedJobs) {
      setSavedJobs(JSON.parse(storedSavedJobs));
    }

    if (storedAppliedJobs) {
      setAppliedJobs(JSON.parse(storedAppliedJobs));
    }
  }, []);

  const toggleSaveJob = (job) => {
    const alreadySaved = savedJobs.some(
      (savedJob) => savedJob.id === job.id
    );

    let updatedJobs;

    if (alreadySaved) {
      updatedJobs = savedJobs.filter(
        (savedJob) => savedJob.id !== job.id
      );
    } else {
      updatedJobs = [...savedJobs, job];
    }

    setSavedJobs(updatedJobs);

    localStorage.setItem(
      "savedJobs",
      JSON.stringify(updatedJobs)
    );
  };

  const applyForJob = (job) => {
    const alreadyApplied = appliedJobs.some(
      (appliedJob) => appliedJob.id === job.id
    );

    if (alreadyApplied) {
      alert("You have already applied for this job.");
      return;
    }

    const newApplication = {
      ...job,
      appliedDate: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      status: "Applied",
    };

    const updatedApplications = [
      ...appliedJobs,
      newApplication,
    ];

    setAppliedJobs(updatedApplications);

    localStorage.setItem(
      "appliedJobs",
      JSON.stringify(updatedApplications)
    );

    alert(`Application submitted for ${job.title}`);
  };

  const filteredJobs = jobs.filter((job) => {
    const searchText = search.toLowerCase();
    const locationText = location.toLowerCase();

    const matchesSearch =
      job.title.toLowerCase().includes(searchText) ||
      job.company.toLowerCase().includes(searchText) ||
      job.skills.toLowerCase().includes(searchText);

    const matchesLocation =
      job.location.toLowerCase().includes(locationText);

    return matchesSearch && matchesLocation;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Find Jobs
          </h1>

          <p className="mt-2 text-gray-600">
            Find the right job opportunity for your career.
          </p>
        </div>

        {/* Search */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Search Jobs
              </label>

              <input
                type="text"
                placeholder="Job title, company or skills"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Location
              </label>

              <input
                type="text"
                placeholder="e.g. Mumbai"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500"
              />
            </div>

          </div>
        </div>

        {/* Job Count */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing{" "}
            <span className="font-semibold text-gray-900">
              {filteredJobs.length}
            </span>{" "}
            jobs
          </p>
        </div>

        {/* Jobs */}
        <div className="space-y-5">

          {filteredJobs.length > 0 ? (
            filteredJobs.map((job) => {

              const isSaved = savedJobs.some(
                (savedJob) => savedJob.id === job.id
              );

              const isApplied = appliedJobs.some(
                (appliedJob) => appliedJob.id === job.id
              );

              return (
                <div
                  key={job.id}
                  className="rounded-xl bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col justify-between gap-5 md:flex-row">

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

                    {/* Buttons */}
                    <div className="flex shrink-0 items-center gap-3 md:flex-col md:items-stretch md:justify-center">

                      <button
                        type="button"
                        onClick={() => toggleSaveJob(job)}
                        className={`rounded-lg border px-5 py-2.5 font-medium ${
                          isSaved
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                            : "border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {isSaved ? "♥ Saved" : "♡ Save Job"}
                      </button>

                      <button
                        type="button"
                        onClick={() => applyForJob(job)}
                        disabled={isApplied}
                        className={`rounded-lg px-5 py-2.5 font-medium text-white ${
                          isApplied
                            ? "cursor-not-allowed bg-gray-400"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        {isApplied ? "Applied" : "Apply Now"}
                      </button>

                    </div>

                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl bg-white p-10 text-center shadow-sm">

              <div className="text-4xl">
                🔍
              </div>

              <h2 className="mt-4 text-xl font-semibold text-gray-900">
                No jobs found
              </h2>

              <p className="mt-2 text-gray-500">
                Try changing your search or location.
              </p>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default JobBoard;