import React, { useState } from "react";

const ResumeManagement = () => {
  const [resume, setResume] = useState(null);
  const [message, setMessage] = useState("");

  const handleResumeUpload = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      setMessage("Please upload a PDF or Word document.");
      return;
    }

    setResume(file);
    setMessage("Resume uploaded successfully!");
  };

  const handleRemoveResume = () => {
    setResume(null);
    setMessage("Resume removed successfully.");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Resume Management
          </h1>

          <p className="mt-2 text-gray-600">
            Upload and manage your latest resume.
          </p>
        </div>

        {/* Resume Card */}
        <div className="rounded-xl bg-white p-6 shadow-sm">

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              My Resume
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Upload your resume in PDF or Word format.
            </p>
          </div>

          {/* Current Resume */}
          {resume ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">

              <div className="flex items-center justify-between gap-4">

                <div>
                  <p className="font-medium text-gray-900">
                    {resume.name}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    {(resume.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveResume}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
                >
                  Remove
                </button>

              </div>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-10 text-center">

              <div className="mb-4 text-4xl">
                📄
              </div>

              <h3 className="text-lg font-semibold text-gray-900">
                Upload your resume
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                PDF, DOC, or DOCX files are supported.
              </p>

              <label className="mt-6 inline-block cursor-pointer rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700">
                Upload Resume

                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeUpload}
                  className="hidden"
                />
              </label>

            </div>
          )}

          {/* Update Resume */}
          {resume && (
            <div className="mt-6">

              <label className="inline-block cursor-pointer rounded-lg border border-emerald-600 px-5 py-2.5 font-medium text-emerald-600 hover:bg-emerald-50">
                Update Resume

                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeUpload}
                  className="hidden"
                />
              </label>

            </div>
          )}

          {/* Message */}
          {message && (
            <div className="mt-6 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-700">
              {message}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ResumeManagement;