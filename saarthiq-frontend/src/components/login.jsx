// src/components/Login.jsx - UPDATED VERSION WITH SIMPLE SERVER BUSY ALERT
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, AlertCircle } from 'lucide-react';
import logo from '../assets/logo.png';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [require2fa, setRequire2fa] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [partialAuthData, setPartialAuthData] = useState(null);
  const [loginData, setLoginData] = useState({
    attempts: 0,
    remainingAttempts: 3,
    maxAttempts: 3,
    locked: false,
    warning: ''
  });
  
  const [serverBusy, setServerBusy] = useState(false);
  
  const navigate = useNavigate();

  // Clean up any stale sessions on component mount
  useEffect(() => {
    const cleanup = async () => {
      const connectionId = localStorage.getItem('connectionId');
      const token = localStorage.getItem('token');
      
      // Clean up if there's a connectionId but no token (stale session)
      if (connectionId && !token) {
        console.log('Cleaning up stale session');
        await handleLogout();
      }
      
      // Also clean up if user navigates to login page directly
      // Clear all local storage to start fresh
      localStorage.clear();
    };
    
    cleanup();
  }, []);

  // Check server connection status on mount and periodically
  useEffect(() => {
    fetchConnectionStatus();
    const interval = setInterval(fetchConnectionStatus, 15000); // Check every 15 seconds
    
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    const connectionId = localStorage.getItem('connectionId');
    const token = localStorage.getItem('token');
    
    if (connectionId || token) {
      try {
        await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ connectionId }),
        });
        
        console.log('Logged out successfully');
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    
    // Clear local storage
    localStorage.clear();
  };

  const fetchConnectionStatus = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/connection-status`,
        { 
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.connectionStatus) {
          // Only show alert when limit is reached
          setServerBusy(data.connectionStatus.isLimitReached);
        }
      }
    } catch (err) {
      console.error('Failed to fetch connection status:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setLoginData(prev => ({ ...prev, warning: '' }));

    // Check if server is busy before attempting login
    if (serverBusy) {
      setError('Server is busy. Please try again in a few minutes.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/login`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (response.ok) {
        if (data.require2fa) {
          setPartialAuthData({
            email: data.email,
            name: data.name
          });
          
          await requestOTP(data.email);
          setRequire2fa(true);
          setLoading(false);
          
          setLoginData({
            attempts: data.attempts || 0,
            remainingAttempts: data.remainingAttempts || 3,
            maxAttempts: 3,
            locked: false,
            warning: ''
          });
        } else {
          await completeLogin(data);
        }
      } else {
        // Handle connection limit error
        if (response.status === 503 && data.connectionStatus) {
          setServerBusy(true);
          setError('Server is busy. Please try again in a few minutes.');
        } else {
          const attempts = data.attempts || 0;
          const totalAttempts = data.totalAttempts || 3;
          const remainingAttempts = data.remainingAttempts || 0;
          const isLocked = data.locked || false;
          
          setLoginData({
            attempts: attempts,
            remainingAttempts: remainingAttempts,
            maxAttempts: totalAttempts,
            locked: isLocked,
            warning: data.warning || ''
          });
          
          let errorMessage = data.message || 'Login failed. Please try again.';
          
          if (isLocked) {
            errorMessage = 'Your account is locked. Contact administrator to unlock.';
          } else if (data.pending) {
            errorMessage = 'Account is pending approval. Please wait for administrator approval.';
          } else if (data.blocked) {
            errorMessage = 'Your account has been permanently blocked by administrator.';
          }
          
          setError(errorMessage);
        }
        setLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('A network error occurred. Please try again.');
      setLoading(false);
    }
  };

  const requestOTP = async (email) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/request-2fa-otp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();
      
      if (response.ok) {
        if (!data.require2fa) {
          setRequire2fa(false);
          return false;
        }
        return true;
      } else {
        setError(data.message || 'Failed to send OTP');
        return false;
      }
    } catch (err) {
      console.error('OTP request error:', err);
      setError('Failed to request OTP. Please try again.');
      return false;
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setOtpLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/verify-2fa`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: partialAuthData.email,
            otp: otp
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        await completeLogin(data);
      } else {
        setError(data.message || 'Invalid OTP. Please try again.');
        setOtpLoading(false);
      }
    } catch (err) {
      console.error('OTP verification error:', err);
      setError('Failed to verify OTP. Please try again.');
      setOtpLoading(false);
    }
  };

  const completeLogin = async (data) => {
    localStorage.setItem('userName', data.name || data.fullname || '');
    localStorage.setItem('userEmail', data.email || '');
    localStorage.setItem('userPhone', data.phone || '');
    localStorage.setItem('userDept', data.department || '');
    localStorage.setItem('connectionId', data.connectionId || '');
    
    if (data.token) localStorage.setItem('token', data.token);
    if (data.employee_id) localStorage.setItem('employeeId', data.employee_id);
    if (data.id) localStorage.setItem('userId', data.id);

    const isAdminValue =
      data.is_admin === 1 ||
      data.is_admin === true ||
      (typeof data.is_admin === 'string' &&
        data.is_admin.toLowerCase() === 'true');

    localStorage.setItem('isAdmin', isAdminValue ? 'true' : 'false');
    localStorage.setItem(
      'can_edit_profile',
      data.canEditProfile ? '1' : '0'
    );

    localStorage.setItem(
      'currentUser',
      JSON.stringify({
        name: data.name || data.fullname || '',
        email: data.email || '',
        phone: data.phone || '',
        department: data.department || '',
        id: data.id,
        is_admin: isAdminValue,
        connectionId: data.connectionId || ''
      })
    );

    setLoading(false);
    
    navigate('/dashboard');
  };

  const resendOTP = async () => {
    if (!partialAuthData?.email) return;
    
    setOtpLoading(true);
    setError('');
    
    const success = await requestOTP(partialAuthData.email);
    
    if (success) {
      setOtp('');
      setError('New OTP sent to your email');
    }
    
    setOtpLoading(false);
  };

  const handleBackToLogin = () => {
    setRequire2fa(false);
    setPartialAuthData(null);
    setOtp('');
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-100">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md flex flex-col items-center hover:shadow-2xl transition">
        <img src={logo} alt="Logo" className="w-32 mb-3" />

        <p className="text-sm font-semibold text-gray-800 mb-3 text-center">
          Talent Corner H.R. Services Pvt. Ltd.
        </p>

        <p className="text-xs text-gray-600 mb-5 text-center">
          {require2fa ? 'Enter your 2FA code' : 'Enter your credentials to access your account'}
        </p>

        {/* Server Busy Alert */}
        {serverBusy && (
          <div className="w-full mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="font-bold text-red-700 text-sm">Server Busy</span>
            </div>
            <p className="text-xs text-red-600">
              Our server is currently at maximum capacity. Please try again in a few minutes.
            </p>
          </div>
        )}

        {!require2fa ? (
          <form onSubmit={handleSubmit} className="space-y-4 w-full mt-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-600 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
                required
                disabled={loading || serverBusy}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-600 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
                  required
                  disabled={loading || serverBusy}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-purple-600 disabled:hover:text-gray-500"
                  tabIndex={-1}
                  disabled={loading || serverBusy}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {loginData.attempts > 0 && !loginData.locked && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-xs font-medium text-yellow-800">
                    Attempt {loginData.attempts} of {loginData.maxAttempts}
                  </span>
                </div>
                
                {loginData.remainingAttempts > 0 && (
                  <div className="text-xs text-yellow-700">
                    <div className="font-semibold mb-1">
                      Remaining attempts: {loginData.remainingAttempts}
                    </div>
                    
                    {loginData.remainingAttempts === 1 && (
                      <div className="text-red-600 font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Next failed attempt will lock your account!
                      </div>
                    )}
                    
                    {loginData.remainingAttempts === 2 && (
                      <div className="text-orange-600 font-medium flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Your account will get locked on next failed attempt. Try Forgot Password to Reset.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {loginData.locked && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-bold text-red-800">
                    Account Locked
                  </span>
                </div>
                <p className="text-xs text-red-700">
                  Your account is locked. Contact administrator to unlock.
                </p>
              </div>
            )}

            {error && !serverBusy && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-md text-xs text-center font-medium animate-fade-in">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-semibold">Error</span>
                </div>
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || loginData.locked || serverBusy}
              className={`w-full py-2 text-white rounded-md font-medium transition duration-200 flex items-center justify-center gap-2 ${
                loading || loginData.locked || serverBusy
                  ? 'bg-purple-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 active:scale-[0.98]'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Logging in...
                </>
              ) : loginData.locked ? (
                <>
                  <Lock className="w-4 h-4" />
                  Account Locked
                </>
              ) : serverBusy ? (
                <>
                  <AlertCircle className="w-4 h-4" />
                  Server Busy - Try Later
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>
        ) : (
          <div className="w-full space-y-4 mt-4">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-600 mt-2">
                A verification code has been sent to<br/>
                <span className="font-semibold">{partialAuthData?.email}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={handleOtpChange}
                placeholder="000000"
                maxLength={6}
                className="w-full px-3 py-3 text-center text-2xl font-mono border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-600 disabled:bg-gray-50"
                disabled={otpLoading}
              />
              <p className="text-xs text-gray-500 mt-1 text-center">
                Enter the 6-digit code from your email
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-md text-xs text-center font-medium">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={verifyOTP}
                disabled={otp.length !== 6 || otpLoading}
                className={`w-full py-2 text-white rounded-md font-medium transition duration-200 flex items-center justify-center gap-2 ${
                  otp.length !== 6 || otpLoading
                    ? 'bg-purple-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {otpLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    Verify & Continue
                  </>
                )}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resendOTP}
                  disabled={otpLoading}
                  className="flex-1 py-2 border border-purple-600 text-purple-600 rounded-md font-medium hover:bg-purple-50 transition disabled:opacity-50"
                >
                  Resend OTP
                </button>
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  disabled={otpLoading}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 text-center w-full">
          <button
            onClick={() => !loading && navigate('/forgot-password')}
            disabled={loading || require2fa || serverBusy}
            className="text-sm text-purple-600 hover:underline disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Forgot Password? Reset it here
          </button>
          
          <div className="mt-2 text-xs text-gray-500">
            Having trouble logging in? Contact administrator
          </div>
        </div>

        <div className="mt-3 text-center text-xs text-gray-600">
          Need an account?{' '}
          <button
            onClick={() => !loading && navigate('/register')}
            disabled={loading || require2fa || serverBusy}
            className="text-purple-600 hover:underline font-medium disabled:text-gray-400"
          >
            Register here
          </button>
        </div>

      </div>
    </div>
  );
};

export default Login;