import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

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

const getCurrentUser = () => {
  try {
    const stored = localStorage.getItem('currentUser');
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (err) {
    console.error('Failed to parse currentUser from localStorage:', err);
    return null;
  }
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const user = getCurrentUser();
  const token = localStorage.getItem('token');

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  const role = user.role || user.user_type || user.department;

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  useEffect(() => {
    console.log('ALL ENV VARS →', import.meta.env);
    console.log('VITE_API_URL →', import.meta.env.VITE_API_URL);
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={[
                'bd',
                'franchisee',
                'recruitment',
                'admin',
                'Business Development',
                'Franchise',
                'Recruitment',
                'Admin',
              ]}
            >
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/advanced-filter"
          element={
            <ProtectedRoute allowedRoles={['bd', 'franchisee', 'recruitment', 'admin']}>
              <AdvancedFilterPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['bd', 'franchisee', 'recruitment', 'admin']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />

        {/* Job Seeker */}
        <Route
          path="/dashboard/job-seeker"
          element={
            <ProtectedRoute allowedRoles={['job_seeker']}>
              <JobSeekerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/job-seeker-profile"
          element={
            <ProtectedRoute allowedRoles={['job_seeker']}>
              <JobSeekerProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/resume-management"
          element={
            <ProtectedRoute allowedRoles={['job_seeker']}>
              <ResumeManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/job-board"
          element={
            <ProtectedRoute allowedRoles={['job_seeker']}>
              <JobBoard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/saved-jobs"
          element={
            <ProtectedRoute allowedRoles={['job_seeker']}>
              <SavedJobs />
            </ProtectedRoute>
          }
        />

        <Route
          path="/applied-jobs"
          element={
            <ProtectedRoute allowedRoles={['job_seeker']}>
              <AppliedJobs />
            </ProtectedRoute>
          }
        />

        {/* Recruiter */}
        <Route
          path="/recruiter-applications"
          element={
            <ProtectedRoute allowedRoles={['recruitment', 'Recruitment']}>
              <RecruiterApplications />
            </ProtectedRoute>
          }
        />

        {/* Employer placeholder for Member 3 */}
        <Route
          path="/dashboard/employer"
          element={
            <ProtectedRoute allowedRoles={['employer']}>
              <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="bg-white p-8 rounded-xl shadow-xl max-w-xl w-full text-center">
                  <h1 className="text-2xl font-bold text-gray-800 mb-3">Employer Dashboard Coming Soon</h1>
                  <p className="text-sm text-gray-600 mb-4">
                    This area is reserved for Employer-specific features (job postings, candidate management, analytics).
                  </p>
                  <p className="text-xs text-gray-500">
                    Member 3 will implement employer flows. Authentication and access control are already wired.
                  </p>
                </div>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
