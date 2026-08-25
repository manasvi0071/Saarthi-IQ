import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './components/login';
import Register from './components/register';
import Dashboard from './components/dashboard';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import AdvancedFilterPage from './components/AdvancedFilterPage'; 
import ReportsPage from './components/ReportsPage';

function App() {

  // 🔥 Add this useEffect to inspect Vercel env variables
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
    </Routes>
  );
}

export default App;
