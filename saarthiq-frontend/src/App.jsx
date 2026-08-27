import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// =====================================================
// AUTH / MAIN COMPONENTS
// =====================================================

import Login from "./components/login";
import Register from "./components/register";
import Dashboard from "./components/dashboard";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import AdvancedFilterPage from "./components/AdvancedFilterPage";
import ReportsPage from "./components/ReportsPage";

// =====================================================
// JOB SEEKER / EXISTING COMPONENTS
// =====================================================

// Keep the imports that already existed in your team's App.jsx.
// Example:
// import JobSeekerDashboard from "./components/jobseeker/JobSeekerDashboard";
// import JobSeekerProfile from "./components/jobseeker/JobSeekerProfile";
// import ResumeManagement from "./components/jobseeker/ResumeManagement";
// import JobBoard from "./components/jobseeker/JobBoard";
// import SavedJobs from "./components/jobseeker/SavedJobs";
// import AppliedJobs from "./components/jobseeker/AppliedJobs";
// import RecruiterApplications from "./components/recruiter/RecruiterApplications";

// =====================================================
// EMPLOYER
// =====================================================

import EmployerLayout from "./employer/EmployerLayout";

import EmployerDashboard from "./employer/EmployerDashboard";
import CompanyProfile from "./employer/CompanyProfile";
import CreateJob from "./employer/CreateJob";
import EditJob from "./employer/EditJob";
import JobPreview from "./employer/JobPreview";
import PostedJobs from "./employer/PostedJobs";


// =====================================================
// GET CURRENT USER
// =====================================================

const getCurrentUser = () => {
  try {
    const stored = localStorage.getItem("currentUser");

    if (!stored) {
      return null;
    }

    return JSON.parse(stored);

  } catch (err) {
    console.error(
      "Failed to parse currentUser from localStorage:",
      err
    );

    return null;
  }
};


// =====================================================
// PROTECTED ROUTE
// =====================================================

const ProtectedRoute = ({ children, allowedRoles }) => {

  const user = getCurrentUser();
  const token = localStorage.getItem("token");

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  const role =
    user.role ||
    user.user_type ||
    user.department;

  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(role)
  ) {
    return <Navigate to="/login" replace />;
  }

  return children;
};


// =====================================================
// APP
// =====================================================

function App() {

  useEffect(() => {
    console.log("ALL ENV VARS →", import.meta.env);
    console.log(
      "VITE_API_URL →",
      import.meta.env.VITE_API_URL
    );
  }, []);

  return (
    <Routes>

      {/* =================================================
          DEFAULT
      ================================================= */}

      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />


      {/* =================================================
          AUTH
      ================================================= */}

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Register />}
      />

      <Route
        path="/forgot-password"
        element={<ForgotPassword />}
      />

      <Route
        path="/reset-password/:token"
        element={<ResetPassword />}
      />


      {/* =================================================
          EXISTING MAIN DASHBOARD
      ================================================= */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute
            allowedRoles={[
              "bd",
              "franchisee",
              "recruitment",
              "admin",
              "Business Development",
              "Franchise",
              "Recruitment",
              "Admin",
            ]}
          >
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/advanced-filter"
        element={
          <ProtectedRoute
            allowedRoles={[
              "bd",
              "franchisee",
              "recruitment",
              "admin",
            ]}
          >
            <AdvancedFilterPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute
            allowedRoles={[
              "bd",
              "franchisee",
              "recruitment",
              "admin",
            ]}
          >
            <ReportsPage />
          </ProtectedRoute>
        }
      />


      {/* =================================================
          JOB SEEKER
      ================================================= */}

      {/* Keep your team's Job Seeker routes here */}


      {/* =================================================
          RECRUITER
      ================================================= */}

      {/* Keep your team's Recruiter routes here */}


      {/* =================================================
          EMPLOYER MODULE
      ================================================= */}

      <Route
        path="/employer"
        element={<EmployerLayout />}
      >

        {/* Employer Dashboard */}
        <Route
          index
          element={<EmployerDashboard />}
        />

        {/* Company Profile */}
        <Route
          path="company-profile"
          element={<CompanyProfile />}
        />

        {/* Create Job */}
        <Route
          path="create-job"
          element={<CreateJob />}
        />

        {/* Edit Job */}
        <Route
          path="edit-job/:id"
          element={<EditJob />}
        />

        {/* Job Preview */}
        <Route
          path="job-preview/:id"
          element={<JobPreview />}
        />

        {/* Posted Jobs */}
        <Route
          path="posted-jobs"
          element={<PostedJobs />}
        />

      </Route>


      {/* =================================================
          OLD EMPLOYER PLACEHOLDER
      ================================================= */}

      {/* 
        We do NOT need the old:

        /dashboard/employer

        "Employer Dashboard Coming Soon"

        because your real Employer module is now available
        at /employer.
      */}


      {/* =================================================
          UNKNOWN ROUTE
      ================================================= */}

      <Route
        path="*"
        element={<Navigate to="/login" replace />}
      />

    </Routes>
  );
}

export default App;