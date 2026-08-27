// src/components/register.jsx - EXTENDED FOR JOB SEEKER & EMPLOYER FLOWS WHILE PRESERVING LEGACY STAFF REGISTRATION (Member 1)
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Building2, AlertCircle, CheckCircle, Mail, Phone, Lock } from 'lucide-react';
import logo from '../assets/logo.png';

const Register = () => {
  const [mode, setMode] = useState('staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    phone: '',
  });

  const [jobSeekerForm, setJobSeekerForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    password: '',
  });

  const [employerForm, setEmployerForm] = useState({
    companyName: '',
    contactPersonName: '',
    email: '',
    mobileNumber: '',
    password: '',
  });

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  const mobileRegex = /^[6-9]\d{9}$/;

  const validatePasswordStrength = (password) => {
    if (!password || password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*]/.test(password)) {
      return 'Password must contain at least one special character (!@#$%^&*)';
    }
    return '';
  };

  const handleStaffChange = (e) => {
    setStaffForm({ ...staffForm, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleJobSeekerChange = (e) => {
    setJobSeekerForm({ ...jobSeekerForm, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleEmployerChange = (e) => {
    setEmployerForm({ ...employerForm, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const { name, email, password, department, phone } = staffForm;

    if (!name || !email || !password || !department || !phone) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (!emailRegex.test(email)) {
      setError('Invalid email format');
      setLoading(false);
      return;
    }

    const cleanedPhone = phone.replace(/\D/g, '');
    if (!mobileRegex.test(cleanedPhone)) {
      setError('Invalid mobile number. Must be 10 digits starting with 6-9');
      setLoading(false);
      return;
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...staffForm, phone: cleanedPhone }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Registration submitted. Awaiting admin approval.');
        setError('');
      } else {
        setError(data.error || data.message || 'Registration failed');
      }
    } catch (err) {
      console.error('Staff registration error:', err);
      setError('Network error during registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJobSeekerSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const { firstName, lastName, email, mobileNumber, password } = jobSeekerForm;

    if (!firstName || !lastName || !email || !mobileNumber || !password) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (!emailRegex.test(email)) {
      setError('Invalid email format');
      setLoading(false);
      return;
    }

    const cleanedMobile = mobileNumber.replace(/\D/g, '');
    if (!mobileRegex.test(cleanedMobile)) {
      setError('Invalid mobile number. Must be 10 digits starting with 6-9');
      setLoading(false);
      return;
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/register/job-seeker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobSeekerForm),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Job seeker registered successfully. You can now login.');
        setError('');
      } else if (response.status === 409) {
        setError(
          data.error ||
            (data.code === 'DUPLICATE_USER'
              ? 'An account already exists with this email or mobile number.'
              : 'Duplicate account detected.')
        );
      } else {
        setError(data.error || data.message || 'Registration failed');
      }
    } catch (err) {
      console.error('Job seeker registration error:', err);
      setError('Network error during registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployerSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const { companyName, contactPersonName, email, mobileNumber, password } = employerForm;

    if (!companyName || !contactPersonName || !email || !mobileNumber || !password) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (!emailRegex.test(email)) {
      setError('Invalid email format');
      setLoading(false);
      return;
    }

    const cleanedMobile = mobileNumber.replace(/\D/g, '');
    if (!mobileRegex.test(cleanedMobile)) {
      setError('Invalid mobile number. Must be 10 digits starting with 6-9');
      setLoading(false);
      return;
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/register/employer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employerForm),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Employer registered successfully. You can now login.');
        setError('');
      } else if (response.status === 409) {
        setError(
          data.error ||
            (data.code === 'DUPLICATE_USER'
              ? 'An account already exists with this email or mobile number.'
              : 'Duplicate account detected.')
        );
      } else {
        setError(data.error || data.message || 'Registration failed');
      }
    } catch (err) {
      console.error('Employer registration error:', err);
      setError('Network error during registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStaffForm = () => (
    <form onSubmit={handleStaffSubmit} className="space-y-4 mt-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
        <input
          type="text"
          name="name"
          value={staffForm.name}
          onChange={handleStaffChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Official Email</label>
        <div className="relative">
          <Mail className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="email"
            name="email"
            value={staffForm.email}
            onChange={handleStaffChange}
            className="w-full pl-9 px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
        <select
          name="department"
          value={staffForm.department}
          onChange={handleStaffChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          required
        >
          <option value="">Select department</option>
          <option value="Business Development">Business Development (BD)</option>
          <option value="Franchise">Franchise</option>
          <option value="Recruitment">Recruitment</option>
          <option value="Admin">Admin</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Mobile Number</label>
        <div className="relative">
          <Phone className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="tel"
            name="phone"
            value={staffForm.phone}
            onChange={handleStaffChange}
            className="w-full pl-9 px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="10-digit mobile number"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
        <div className="relative">
          <Lock className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="password"
            name="password"
            value={staffForm.password}
            onChange={handleStaffChange}
            className="w-full pl-9 px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-1">
          Must be at least 8 characters and include uppercase, lowercase, number, and special character.
        </p>
      </div>
      <button
        type="submit"
        disabled={loading}
        className={`w-full py-2 text-white rounded-md font-medium transition duration-200 flex items-center justify-center gap-2 ${
          loading ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
        }`}
      >
        {loading ? 'Submitting...' : 'Submit for Admin Approval'}
      </button>
    </form>
  );

  const renderJobSeekerForm = () => (
    <form onSubmit={handleJobSeekerSubmit} className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
          <input
            type="text"
            name="firstName"
            value={jobSeekerForm.firstName}
            onChange={handleJobSeekerChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
          <input
            type="text"
            name="lastName"
            value={jobSeekerForm.lastName}
            onChange={handleJobSeekerChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
        <div className="relative">
          <Mail className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="email"
            name="email"
            value={jobSeekerForm.email}
            onChange={handleJobSeekerChange}
            className="w-full pl-9 px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Mobile Number</label>
        <div className="relative">
          <Phone className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="tel"
            name="mobileNumber"
            value={jobSeekerForm.mobileNumber}
            onChange={handleJobSeekerChange}
            className="w-full pl-9 px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="10-digit mobile number"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
        <div className="relative">
          <Lock className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="password"
            name="password"
            value={jobSeekerForm.password}
            onChange={handleJobSeekerChange}
            className="w-full pl-9 px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-1">
          Must be at least 8 characters and include uppercase, lowercase, number, and special character.
        </p>
      </div>
      <button
        type="submit"
        disabled={loading}
        className={`w-full py-2 text-white rounded-md font-medium transition duration-200 flex items-center justify-center gap-2 ${
          loading ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
        }`}
      >
        {loading ? 'Registering...' : 'Register as Job Seeker'}
      </button>
    </form>
  );

  const renderEmployerForm = () => (
    <form onSubmit={handleEmployerSubmit} className="space-y-4 mt-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Company Name</label>
        <input
          type="text"
          name="companyName"
          value={employerForm.companyName}
          onChange={handleEmployerChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Contact Person Name</label>
        <input
          type="text"
          name="contactPersonName"
          value={employerForm.contactPersonName}
          onChange={handleEmployerChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Official Email</label>
        <div className="relative">
          <Mail className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="email"
            name="email"
            value={employerForm.email}
            onChange={handleEmployerChange}
            className="w-full pl-9 px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Mobile Number</label>
        <div className="relative">
          <Phone className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="tel"
            name="mobileNumber"
            value={employerForm.mobileNumber}
            onChange={handleEmployerChange}
            className="w-full pl-9 px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="10-digit mobile number"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
        <div className="relative">
          <Lock className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="password"
            name="password"
            value={employerForm.password}
            onChange={handleEmployerChange}
            className="w-full pl-9 px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-1">
          Must be at least 8 characters and include uppercase, lowercase, number, and special character.
        </p>
      </div>
      <button
        type="submit"
        disabled={loading}
        className={`w-full py-2 text-white rounded-md font-medium transition duration-200 flex items-center justify-center gap-2 ${
          loading ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
        }`}
      >
        {loading ? 'Registering...' : 'Register as Employer'}
      </button>
    </form>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-100">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg hover:shadow-2xl transition">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-16" />
            <div>
              <p className="text-sm font-semibold text-gray-800">Talent Corner H.R. Services Pvt. Ltd.</p>
              <p className="text-xs text-gray-500">Unified Registration Portal</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="text-xs text-purple-600 hover:underline"
          >
            Back to Login
          </button>
        </div>

        <div className="border border-gray-200 rounded-md overflow-hidden mb-4">
          <div className="grid grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setMode('staff');
                setError('');
                setSuccess('');
              }}
              className={`py-2 text-xs font-semibold flex items-center justify-center gap-1 border-r border-gray-200 ${
                mode === 'staff' ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-700'
              }`}
            >
              <UserPlus className="w-3 h-3" />
              Staff
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('job_seeker');
                setError('');
                setSuccess('');
              }}
              className={`py-2 text-xs font-semibold flex items-center justify-center gap-1 border-r border-gray-200 ${
                mode === 'job_seeker' ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-700'
              }`}
            >
              <UserPlus className="w-3 h-3" />
              Job Seeker
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('employer');
                setError('');
                setSuccess('');
              }}
              className={`py-2 text-xs font-semibold flex items-center justify-center gap-1 ${
                mode === 'employer' ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-700'
              }`}
            >
              <Building2 className="w-3 h-3" />
              Employer
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-md text-xs mb-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-3 py-2 rounded-md text-xs mb-3 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5" />
            <div>
              <p className="font-semibold">Success</p>
              <p>{success}</p>
            </div>
          </div>
        )}

        {mode === 'staff' && (
          <>
            <h2 className="text-sm font-semibold text-gray-800 mb-1">Staff Registration (BD / Franchise / Recruitment / Admin)</h2>
            <p className="text-xs text-gray-500 mb-2">
              Submit your details for admin approval. You will receive login credentials after approval.
            </p>
            {renderStaffForm()}
          </>
        )}

        {mode === 'job_seeker' && (
          <>
            <h2 className="text-sm font-semibold text-gray-800 mb-1">Job Seeker Registration</h2>
            <p className="text-xs text-gray-500 mb-2">
              Create your account to manage applications, resumes, and saved jobs.
            </p>
            {renderJobSeekerForm()}
          </>
        )}

        {mode === 'employer' && (
          <>
            <h2 className="text-sm font-semibold text-gray-800 mb-1">Employer Registration</h2>
            <p className="text-xs text-gray-500 mb-2">
              Create your employer account to post jobs and review candidates.
            </p>
            {renderEmployerForm()}
          </>
        )}
      </div>
    </div>
  );
};

export default Register;
