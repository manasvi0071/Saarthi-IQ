import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const employerApi = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Send JWT if your existing login stores it
employerApi.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Company
export const getCompanyProfile = () =>
  employerApi.get("/employer/company");

export const updateCompanyProfile = (data) =>
  employerApi.put("/employer/company", data);

// Jobs
export const getEmployerJobs = () =>
  employerApi.get("/employer/jobs");

export const getEmployerJob = (id) =>
  employerApi.get(`/employer/jobs/${id}`);

export const createEmployerJob = (data) =>
  employerApi.post("/employer/jobs", data);

export const updateEmployerJob = (id, data) =>
  employerApi.put(`/employer/jobs/${id}`, data);

export const publishEmployerJob = (id) =>
  employerApi.post(`/employer/jobs/${id}/publish`);

export const closeEmployerJob = (id) =>
  employerApi.post(`/employer/jobs/${id}/close`);

export default employerApi;