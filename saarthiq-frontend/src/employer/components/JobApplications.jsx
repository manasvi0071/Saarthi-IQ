import React, { useEffect, useState } from "react";

const statusStyles = {
  applied: "bg-blue-100 text-blue-700",
  shortlisted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  interview_scheduled: "bg-purple-100 text-purple-700",
};

const JobApplications = ({ jobId }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState(null);

  // Interview scheduling modal state
  const [schedulingFor, setSchedulingFor] = useState(null); // applicationId
  const [scheduledTime, setScheduledTime] = useState("");
  const [mode, setMode] = useState("online");
  const [notes, setNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem("token");

  const fetchApplications = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/applications/job/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load applications");
      setApplications(data.applications || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jobId) fetchApplications();
  }, [jobId]);

  const updateStatus = async (applicationId, status) => {
    setActionId(applicationId);
    try {
      const res = await fetch(`${API_URL}/api/applications/${applicationId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update status");

      setApplications((prev) =>
        prev.map((app) => (app.id === applicationId ? { ...app, status } : app))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setActionId(null);
    }
  };

  const openScheduleModal = (applicationId) => {
    setSchedulingFor(applicationId);
    setScheduledTime("");
    setMode("online");
    setNotes("");
  };

  const submitSchedule = async () => {
    if (!scheduledTime) {
      alert("Please pick a date and time.");
      return;
    }
    setScheduling(true);
    try {
      const res = await fetch(`${API_URL}/api/interviews/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          applicationId: schedulingFor,
          scheduledTime,
          mode,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to schedule interview");

      setApplications((prev) =>
        prev.map((app) =>
          app.id === schedulingFor ? { ...app, status: "interview_scheduled" } : app
        )
      );
      setSchedulingFor(null);
      alert("Interview scheduled successfully.");
    } catch (err) {
      alert(err.message);
    } finally {
      setScheduling(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-500">Loading applications...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Applications ({applications.length})
      </h2>

      {applications.length === 0 ? (
        <p className="text-gray-500">No applications yet for this job.</p>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              <div>
                <p className="font-semibold text-gray-900">{app.name}</p>
                <p className="text-sm text-gray-600">{app.email}</p>
                {app.phone && <p className="text-sm text-gray-600">{app.phone}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  Applied on {new Date(app.applied_at).toLocaleDateString()}
                </p>
                <span
                  className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                    statusStyles[app.status] || "bg-gray-100 text-gray-700"
                  }`}
                >
                  {app.status.replace("_", " ")}
                </span>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => updateStatus(app.id, "shortlisted")}
                  disabled={actionId === app.id || app.status === "shortlisted"}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  Shortlist
                </button>
                <button
                  onClick={() => updateStatus(app.id, "rejected")}
                  disabled={actionId === app.id || app.status === "rejected"}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => openScheduleModal(app.id)}
                  disabled={app.status === "rejected"}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  Schedule Interview
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Simple inline schedule modal */}
      {schedulingFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Schedule Interview</h3>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3"
            />

            <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3"
            >
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
              rows={3}
            />

            <div className="flex gap-2">
              <button
                onClick={submitSchedule}
                disabled={scheduling}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {scheduling ? "Scheduling..." : "Confirm"}
              </button>
              <button
                onClick={() => setSchedulingFor(null)}
                disabled={scheduling}
                className="flex-1 border border-gray-300 py-2 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobApplications;