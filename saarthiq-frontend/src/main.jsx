import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import axios from 'axios';

// DEPLOYMENT FIX: Use correct VITE environment variable name
const API_URL = import.meta.env.VITE_API_URL || 'https://api.saarthiq.com/api';

// Apply to Axios — this is what makes login work online
axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true;

// Optional: Helpful debug in production
if (import.meta.env.PROD) {
  console.log('%c API BASE URL →', 'color: #8b5cf6; font-weight: bold;', API_URL);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
