import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import EmployerLayout from "./employer/EmployerLayout";

import EmployerDashboard from "./employer/EmployerDashboard";
import CompanyProfile from "./employer/CompanyProfile";
import CreateJob from "./employer/CreateJob";
import EditJob from "./employer/EditJob";
import JobPreview from "./employer/JobPreview";
import PostedJobs from "./employer/PostedJobs";

function App() {
  return (
    <Routes>

      <Route
        path="/"
        element={<Navigate to="/employer" replace />}
      />

      <Route
        path="/employer"
        element={
          <EmployerLayout>
            <EmployerDashboard />
          </EmployerLayout>
        }
      />

      <Route
        path="/employer/company-profile"
        element={
          <EmployerLayout>
            <CompanyProfile />
          </EmployerLayout>
        }
      />

      <Route
        path="/employer/create-job"
        element={
          <EmployerLayout>
            <CreateJob />
          </EmployerLayout>
        }
      />

      <Route
        path="/employer/edit-job/:id"
        element={
          <EmployerLayout>
            <EditJob />
          </EmployerLayout>
        }
      />

      <Route
        path="/employer/job-preview/:id"
        element={
          <EmployerLayout>
            <JobPreview />
          </EmployerLayout>
        }
      />

      <Route
        path="/employer/posted-jobs"
        element={
          <EmployerLayout>
            <PostedJobs />
          </EmployerLayout>
        }
      />

      <Route
        path="*"
        element={<Navigate to="/employer" replace />}
      />

    </Routes>
  );
}

export default App;