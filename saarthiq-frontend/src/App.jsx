import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';

import Login from './components/login';
import Register from './components/register';
import Dashboard from './components/dashboard';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import AdvancedFilterPage from './components/AdvancedFilterPage';
import ReportsPage from './components/ReportsPage';

import JobSeekerDashboard from './components/jobseeker/JobSeekerDashboard';
import JobSeekerProfile from './components/jobseeker/JobSeekerProfile';
import ResumeManagement from './components/jobseeker/ResumeManagement';
import JobBoard from './components/jobseeker/JobBoard';
import SavedJobs from './components/jobseeker/SavedJobs';
import AppliedJobs from './components/jobseeker/AppliedJobs';

import RecruiterApplications from './components/recruiter/RecruiterApplications';

function App() {
  useEffect(() => {
    console.log("ALL ENV VARS →", import.meta.env);
    console.log("VITE_API_URL →", import.meta.env.VITE_API_URL);
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/advanced-filter" element={<AdvancedFilterPage />} />
      <Route path="/reports" element={<ReportsPage />} />

      {/* Job Seeker */}
      <Route
        path="/job-seeker-dashboard"
        element={<JobSeekerDashboard />}
      />

      <Route
        path="/job-seeker-profile"
        element={<JobSeekerProfile />}
      />

      <Route
        path="/resume-management"
        element={<ResumeManagement />}
      />

      <Route
        path="/job-board"
        element={<JobBoard />}
      />

      <Route
        path="/saved-jobs"
        element={<SavedJobs />}
      />

      <Route
        path="/applied-jobs"
        element={<AppliedJobs />}
      />

      {/* Recruiter */}
      <Route
        path="/recruiter-applications"
        element={<RecruiterApplications />}
      />
    </Routes>
  );
}

export default App;