// src/components/Dashboard.jsx - UPDATED VERSION (with notification badge fix)
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadForm from './UploadForm.jsx';
import UserManagement from './UserManagement.jsx';
import logo from '../assets/logo.png';
import setting from '../assets/setting.png';
import adminManualPDF from '../assets/ADMIN USER MANUAL.pdf';
import userManualPDF from '../assets/user_manual_saarthiq(3).pdf';
import { io } from 'socket.io-client';
import { 
  Users, UploadCloud, Search, FileText, LogOut, X, Lock, 
  AlertCircle, CheckCircle, UserPlus, Edit, UserCheck, UserX, 
  FileUp, Key, Book, Shield, Download, Maximize2, Minimize2, ExternalLink, Bell
} from 'lucide-react'; 

const API_BASE_URL = import.meta.env.VITE_API_URL; 
const SOCKET_URL = API_BASE_URL.replace('/api', '');

// Socket instance
let socket = null;

const getLS = (keys) => {
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v && v !== 'undefined' && v !== 'null') return v;
  }
  return '';
};

const checkAdminStatus = () => {
  const raw = localStorage.getItem('isAdmin') || '';
  const val = typeof raw === 'string' ? raw.toLowerCase() : '';
  return val === 'true' || val === '1' || val === 'yes' || val === 'admin';
};

const Dashboard = () => {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [datasets, setDatasets] = useState([]);
  const [totalProfiles, setTotalProfiles] = useState(0); 
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdvSubmenu, setShowAdvSubmenu] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [lockedAccountsCount, setLockedAccountsCount] = useState(0);
  const [activeUsersData, setActiveUsersData] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [emailAutomationEnabled, setEmailAutomationEnabled] = useState(true);
  
  // Manual viewing states
  const [showManual, setShowManual] = useState(false);
  const [manualType, setManualType] = useState('user'); // 'user' or 'admin'
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Toast notification
  const [toastNotification, setToastNotification] = useState(null);

  const userId = getLS(['userId', 'id']); 
  const userToken = getLS(['token', 'authToken']); 
  const userEmail = getLS(['userEmail', 'email']);
  const userName = getLS(['userName', 'name']);
  const connectionId = getLS(['connectionId']);
  
  const [profile, setProfile] = useState({
    name: getLS(['userName', 'name']), 
    email: getLS(['userEmail', 'email']),
    phone: getLS(['userPhone', 'phone']),
    department: getLS(['userDept', 'department']),
    employeeId: getLS(['employeeId', 'employee_id']), 
  });
  
  // Calculate total notifications for admin
  const totalAdminNotifications = pendingCount + lockedAccountsCount;
  
  // Fetch all admin notification counts
// In Dashboard.jsx, replace the fetchAdminNotificationCounts function with:

const fetchAdminNotificationCounts = useCallback(async () => {
  if (!userToken || !isAdmin) return;
  
  try {
    // Fetch ALL users and filter client-side
    const res = await fetch(`${API_BASE_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
    });
    
    if (res.ok) {
      const data = await res.json();
      const allUsers = data.users || [];
      
      // Count pending users
      const pendingCount = allUsers.filter(u => u.is_approved === 0).length;
      setPendingCount(pendingCount);
      
      // Count locked users
      const lockedCount = allUsers.filter(u => 
        u.is_locked === 1 || u.is_blocked === 1
      ).length;
      setLockedAccountsCount(lockedCount);
    }
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
  }
}, [userToken, isAdmin]);

  // Fetch user profile with updated data
  const fetchProfileData = useCallback(async () => {
    if (!userId || !userToken) {
        setIsAdmin(checkAdminStatus()); 
        return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${userToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        
        setProfile({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '', 
          department: data.department || '',
          employeeId: data.employee_id || '',
        });
        
        localStorage.setItem('userName', data.name || '');
        localStorage.setItem('userEmail', data.email || '');
        localStorage.setItem('userPhone', data.phone || '');
        localStorage.setItem('userDept', data.department || '');
        localStorage.setItem('employeeId', data.employee_id || ''); 
        localStorage.setItem('isAdmin', data.is_admin ? 'true' : 'false');
        
        setIsAdmin(data.is_admin);
        
        // If admin, fetch notification counts immediately
        if (data.is_admin) {
          fetchAdminNotificationCounts();
        }
      }
    } catch (e) {
      console.error("Error fetching user data:", e);
    }
  }, [userId, userToken, fetchAdminNotificationCounts]); 
 
  // Fetch updated profile data (when admin edits user)
  const fetchUpdatedProfile = async () => {
    if (!userId || !userToken) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${userToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          const updatedUser = data.user;
          
          setProfile({
            name: updatedUser.name || '',
            email: updatedUser.email || '',
            phone: updatedUser.phone || '',
            department: updatedUser.department || '',
            employeeId: updatedUser.employee_id || '',
          });
          
          // Update localStorage
          localStorage.setItem('userName', updatedUser.name || '');
          localStorage.setItem('userPhone', updatedUser.phone || '');
          localStorage.setItem('userDept', updatedUser.department || '');
          localStorage.setItem('employeeId', updatedUser.employee_id || '');
          
          setIsAdmin(updatedUser.is_admin);
        }
      }
    } catch (e) {
      console.error("Error fetching updated profile:", e);
    }
  };

  // Fetch email automation setting
  const fetchEmailAutomationSetting = useCallback(async () => {
    if (!userToken) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/system/settings`, {
        headers: { 'Authorization': `Bearer ${userToken}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setEmailAutomationEnabled(data.settings.emailAutomation);
        }
      }
    } catch (error) {
      console.error('Error fetching email settings:', error);
    }
  }, [userToken]);

  // Fetch stats
  const fetchStats = useCallback(() => {
    fetch(`${API_BASE_URL}/api/filters/stats`)
      .then(res => res.ok ? res.json() : { totalProfiles: 0, totalFiles: 0 })
      .then(data => {
        setTotalProfiles(data.totalProfiles || 0);
      })
      .catch(err => {
        console.error('Error fetching stats:', err);
        setTotalProfiles(0);
      });
  }, []);

  // Setup socket connection
  useEffect(() => {
    if (!userToken) return;

    // Initialize socket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);

      // Emit userConnected event with all user data
      socket.emit('userConnected', {
        userId: userId,
        name: getLS(['userName', 'name']),
        email: userEmail,
        department: getLS(['userDept', 'department']),
        isAdmin: checkAdminStatus(),
        connectionId: connectionId,
      });
    });

    // Listen for connection count updates (for all users)
    socket.on('connectionCountUpdate', (data) => {
      setOnlineUsers(data.count);
    });

    // Listen for admin-specific updates
    socket.on('adminConnectionUpdate', (data) => {
      if (isAdmin) {
        setOnlineUsers(data.count);
        setActiveUsersData(data.activeUsers || []);
      }
    });

    // Listen for new notifications (admin only) - FIXED VERSION
    socket.on('newNotification', (data) => {
  if (!isAdmin) return;

  // 🔥 INSTANTLY update counts (optimistic UI)
  if (data.type === 'new_registration') {
    setPendingCount(prev => prev + 1);
  }

  if (data.type === 'account_locked') {
    setLockedAccountsCount(prev => prev + 1);
  }

  // 🔁 Still sync with backend (safety)
  fetchAdminNotificationCounts();

  // Toast logic (unchanged)
  let notificationMessage = '';
  let notificationType = 'info';

  switch (data.type) {
    case 'new_registration':
      notificationMessage = 'New User Registration';
      notificationType = 'info';
      break;
    case 'account_locked':
      notificationMessage = 'Account Locked';
      notificationType = 'warning';
      break;
    case 'user_login':
      notificationMessage = 'User Logged In';
      notificationType = 'success';
      break;
    default:
      notificationMessage = data.title || 'New Notification';
  }

  setToastNotification({
    type: notificationType,
    message: notificationMessage,
    subtext: data.sourceData?.name || 'Check Manage Users for details'
  });

  setTimeout(() => setToastNotification(null), 5000);
});


    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.warn('❌ Socket disconnected:', reason);
    });

    // Store socket globally for logout
    window.socket = socket;

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [userToken, userId, connectionId, isAdmin, fetchAdminNotificationCounts]);

  // Fetch notification counts on component mount if admin
  useEffect(() => {
    if (isAdmin && userToken) {
      console.log('🔄 Fetching initial notification counts for admin');
      fetchAdminNotificationCounts();
      
      // Also set up an interval to refresh counts every 30 seconds
      const interval = setInterval(() => {
        if (isAdmin && userToken) {
          fetchAdminNotificationCounts();
        }
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [isAdmin, userToken, fetchAdminNotificationCounts]);

  // Fetch data on component mount
  useEffect(() => {
    fetchProfileData();
    fetchStats();
    fetchEmailAutomationSetting();
  }, [fetchProfileData, fetchStats, fetchEmailAutomationSetting]);

  // Fetch files
  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/files`);
      if (response.ok) {
        const result = await response.json();
        setDatasets(result.success ? (result.files || []) : []);
      } else {
        setDatasets([]);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      setDatasets([]);
    } finally {
      setIsLoading(false);
    }
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleSave = async () => {
    if (!userId || !userToken) {
        alert("Authentication error. Please log in again.");
        return;
    }
    
    const updateData = {
        name: profile.name,
        phone: profile.phone,
        // Note: Department is NOT included - users cannot edit their department
        // Only admins can change department
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}/profile-update`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`,
            },
            body: JSON.stringify(updateData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update profile.');
        }

        await fetchUpdatedProfile();
        setIsEditing(false);
        setToastNotification({
          type: 'success',
          message: 'Profile updated successfully!'
        });
        setTimeout(() => setToastNotification(null), 5000);

    } catch (error) {
        setToastNotification({
          type: 'error',
          message: 'Error saving profile: ' + error.message
        });
        setTimeout(() => setToastNotification(null), 5000);
    }
  };

  const handleLogout = async () => {
    const connectionId = localStorage.getItem('connectionId');
    
    try {
      // 4️⃣ VERY IMPORTANT: Notify socket about logout BEFORE clearing localStorage
      if (socketRef.current && connectionId) {
        socketRef.current.emit("userLogout", {
          connectionId: connectionId,
        });
      }
      
      // Remove connection from backend
      if (connectionId) {
        try {
          await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ connectionId })
          });
          console.log(`✅ Connection ${connectionId} removed from tracking`);
        } catch (error) {
          console.error('Error removing connection during logout:', error);
          // Continue with logout even if connection removal fails
        }
      }
      
      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
    } catch (error) {
      console.error('Error during logout cleanup:', error);
    } finally {
      // Always clear localStorage and navigate
      localStorage.clear();
      navigate('/login');
    }
  };

  // Open manual function
  const openManual = (type) => {
    setManualType(type);
    setShowManual(true);
    setIsFullscreen(false);
  };

  // Open manual in new tab
  const openManualInNewTab = () => {
    const manualUrl = manualType === 'admin' ? adminManualPDF : userManualPDF;
    window.open(manualUrl, '_blank');
  };

  // Download manual
  const downloadManual = () => {
    const manualUrl = manualType === 'admin' ? adminManualPDF : userManualPDF;
    const link = document.createElement('a');
    link.href = manualUrl;
    link.download = manualType === 'admin' ? 'admin-manual.pdf' : 'user-manual.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle notification count changes from UserManagement
  const handleNotificationCountsChange = (counts) => {
    if (counts.pending !== undefined) setPendingCount(counts.pending);
    if (counts.locked !== undefined) setLockedAccountsCount(counts.locked);
  };

  const filtered = Array.isArray(datasets) 
  ? datasets.filter(d => {
      if (!d) return false;
      const searchTerm = search.toLowerCase();
      return (
        (d.original_name?.toLowerCase().includes(searchTerm) || false) ||
        (d.name?.toLowerCase().includes(searchTerm) || false) ||
        (d.uploaded_by?.toLowerCase().includes(searchTerm) || false)
      );
    })
  : [];

  const formatFileSize = (sizeMb) => {
    const size = Number(sizeMb || 0);
    if (size === 0) return '0 MB';
    return size >= 1024
      ? `${(size / 1024).toFixed(2)} GB`
      : `${size.toFixed(2)} MB`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', 
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '-';
    }
  };

  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Just now';
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="fixed top-0 left-0 h-full bg-white border-r border-gray-200 shadow-xl w-64 z-40 p-6 flex flex-col justify-between">
          <div>
            <img src={logo} alt="Logo" className="w-40 mb-10" />
            <nav className="space-y-3">
              <button 
                onClick={() => navigate('/dashboard')}
                className="text-left w-full font-semibold text-gray-600 hover:text-purple-700 transition duration-150 hover:bg-purple-50 py-2 px-3 rounded-md flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                </svg>
                <span>Dashboard</span>
              </button>
              
              {!isAdmin ? (
                <button 
                  onClick={() => navigate('/advanced-filter')} 
                  className="text-left w-full font-semibold text-gray-600 hover:text-purple-700 hover:bg-purple-50 py-2 px-3 rounded-md flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                  </svg>
                  <span>Advanced Filters</span>
                </button>
              ) : (
                <div className="relative">
                  <button 
                    onClick={() => setShowAdvSubmenu(v => !v)} 
                    className="text-left w-full font-semibold text-gray-600 hover:text-purple-700 flex justify-between items-center hover:bg-purple-50 py-2 px-3 rounded-md flex items-center gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                      </svg>
                      <span>Advanced Filters</span>
                    </div>
                    <svg 
                      className={`w-4 h-4 transition duration-150 ${showAdvSubmenu ? 'rotate-180' : ''}`} 
                      viewBox="0 0 20 20" 
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
                    </svg>
                  </button>
                  {showAdvSubmenu && (
                    <div className="ml-5 mt-1 space-y-1 border-l-2 border-purple-300 pl-3">
                      {['Business Development', 'Recruitment', 'Franchise'].map((name) => (
  <button
    key={name}
    onClick={() => {
      localStorage.setItem('userDept', name);
      navigate('/advanced-filter');
    }}
    className="block w-full text-left text-sm py-1.5 rounded-md text-gray-700 hover:bg-purple-50 px-2 transition duration-150"
  >
    {name === 'Business Development' ? 'BD' : 
     name === 'Recruitment' ? 'Recruitment (Franchise)' : 
     name === 'Franchise' ? 'Franchise Development' : 
     name}
  </button>
))}
                    </div>
                  )}
                </div>
              )}
              
              <button 
                onClick={() => navigate('/reports')} 
                className="text-left w-full font-semibold text-gray-600 hover:text-purple-700 hover:bg-purple-50 py-2 px-3 rounded-md flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <span>Reports</span>
              </button>
              
              {isAdmin && (
                <button 
                  onClick={() => setIsUserManagementOpen(true)} 
                  className="text-left w-full font-semibold text-gray-600 hover:text-purple-700 flex items-center justify-between hover:bg-purple-50 py-2 px-3 rounded-md transition duration-150 relative"
                >
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                    <span>Manage Users</span>
                  </div>
                  {/* Combined notification badge for all admin notifications - NOW SHOWS IMMEDIATELY */}
                  {totalAdminNotifications > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse min-w-5 flex justify-center items-center">
                          {totalAdminNotifications > 99 ? '99+' : totalAdminNotifications}
                      </span>
                  )}
                </button>
              )}
              
              {/* User Manual Button - For all users */}
              <button 
                onClick={() => openManual('user')}
                className="text-left w-full font-semibold text-gray-600 hover:text-purple-700 hover:bg-purple-50 py-2 px-3 rounded-md flex items-center gap-2"
              >
                <Book size={18} />
                <span>User Manual</span>
              </button>
              
              {/* Admin Manual Button - Only for admins */}
              {isAdmin && (
                <button 
                  onClick={() => openManual('admin')}
                  className="text-left w-full font-semibold text-gray-600 hover:text-red-700 hover:bg-red-50 py-2 px-3 rounded-md flex items-center gap-2"
                >
                  <Shield size={18} />
                  <span>Admin Manual</span>
                </button>
              )}
            </nav>
          </div>
          
          <button 
            onClick={handleLogout} 
            className="mt-6 bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 transition duration-150 shadow-md flex items-center justify-center gap-2"
          >
            <LogOut size={18} /> 
            Logout
          </button>
        </aside>
      )}

      {/* Main Content */}
      <main className={`flex-1 p-8 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className="p-2 rounded hover:bg-gray-100 text-gray-600 transition duration-150"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Hello, {profile.name || 'User'}</h1>
          </div>
          <div className="flex items-center gap-4">
            
            {isAdmin && (
  <button 
  onClick={async () => {
    try {
      // Fetch active users count
      const response = await fetch(`${API_BASE_URL}/api/dashboard/active-users-count`, {
        headers: { 
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
      });
      
      let activeUsersCount = onlineUsers; // fallback to socket count
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          activeUsersCount = data.activeUsersCount;
        }
      }
      
      // Show modal with count
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
      modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-2xl w-full max-w-sm">
          <div class="p-6 border-b">
            <h2 class="text-xl font-bold text-purple-700">Active Users</h2>
          </div>
          <div class="p-6">
            <div class="text-center">
              <div class="text-4xl font-bold text-purple-600 mb-2">${activeUsersCount}</div>
              <p class="text-gray-600">Users currently online</p>
            </div>
          </div>
          <div class="p-6 border-t">
            <div class="flex justify-end">
              <button id="closeModal" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition duration-150">
                Close
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#closeModal').onclick = () => modal.remove();
      modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
      };
    } catch (error) {
      console.error('Error fetching active users count:', error);
    }
  }}
  className="flex items-center gap-2 text-purple-600 font-semibold text-sm bg-purple-50 py-1 px-3 rounded-full hover:bg-purple-100 transition duration-150 border border-purple-200"
  title="Click to view active users count"
>
  <Users size={16} />
  Active Users
</button>
)}
            
            {/* Settings Button */}
            <button 
                onClick={() => {
                    fetchUpdatedProfile(); 
                    setIsProfileOpen(true);
                }} 
                className="p-2 rounded-full bg-gray-100 hover:bg-purple-100 transition duration-150 hover:shadow-md"
                title="Profile Settings"
            >
              <img src={setting} alt="Settings" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-100 flex flex-col justify-center items-center transition-transform duration-200 hover:scale-[1.02]">
            <Users size={40} className="text-green-600 mb-2" />
            <p className="text-sm font-medium text-gray-500 uppercase">Total Profiles</p>
            <h2 className="text-4xl font-extrabold text-gray-800 mt-1">{totalProfiles.toLocaleString()}</h2>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-100 flex flex-col justify-center items-center transition-transform duration-200 hover:scale-[1.02]">
            <UploadCloud size={40} className="text-purple-600 mb-2" />
            <p className="text-sm font-medium text-gray-600 uppercase">Total Files Uploaded</p>
            <h2 className="text-4xl font-extrabold text-gray-800 mt-1">{datasets.length}</h2>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 transition-transform duration-200 hover:scale-[1.02]">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Quick File Upload</h2> 
            <UploadForm onUpload={() => fetchFiles()} compact />
          </div>
        </div>

        {/* Datasets Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <h3 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                <FileText size={20} className="text-purple-600" /> Uploaded Datasets
            </h3>
            <div className="relative w-full md:w-auto">
              <input
                type="text"
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full md:w-64 focus:ring-purple-500 focus:border-purple-500 focus:outline-none transition duration-150"
              />
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-purple-50">
                <tr className="text-left text-xs text-purple-700 uppercase tracking-wider">
                  <th className="py-3 px-4 font-bold">Name</th>
                  <th className="py-3 px-4 font-bold">Size</th>
                  <th className="py-3 px-4 font-bold">Last Modified</th>
                  <th className="py-3 px-4 font-bold">Uploaded By</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-gray-500">
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                      </div>
                    </td>
                  </tr>
                ) : !Array.isArray(datasets) || datasets.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-gray-500 italic">
                      No datasets available.
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-gray-500 italic">
                      {search ? 'No datasets match your search.' : 'No datasets available.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((file, idx) => (
                    <tr 
                      key={file.id || idx} 
                      className="hover:bg-gray-50 transition duration-150"
                    >
                      <td className="py-3 px-4 text-gray-800 font-medium">{file.original_name || file.name || 'Unnamed File'}</td>
                      <td className="py-3 px-4 text-gray-600">{formatFileSize(file.size_mb)}</td>
                      <td className="py-3 px-4 text-xs text-gray-500">{formatDate(file.modified)}</td>
                      <td className="py-3 px-4 text-gray-600">{file.uploaded_by || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Manual PDF Viewer Modal */}
        {showManual && (
          <div className={`fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 ${isFullscreen ? 'p-0' : 'p-4'}`}>
            <div className={`bg-white rounded-lg shadow-2xl flex flex-col transition-all duration-300 ${
              isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-6xl max-h-[90vh]'
            }`}>
              {/* Header */}
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${manualType === 'admin' ? 'bg-red-100' : 'bg-purple-100'}`}>
                    {manualType === 'admin' ? (
                      <Shield className="w-5 h-5 text-red-600" />
                    ) : (
                      <Book className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      {manualType === 'admin' ? 'Admin Manual' : 'SaarthIQ User Manual'}
                    </h2>
                    <p className="text-sm text-gray-600">
                      Talent Corner H.R. Services Pvt. Ltd.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Download Button */}
                  <button
                    onClick={downloadManual}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition duration-150"
                    title="Download PDF"
                  >
                    <Download size={20} />
                  </button>
                  
                  {/* Open in New Tab */}
                  <button
                    onClick={openManualInNewTab}
                    className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition duration-150"
                    title="Open in new tab"
                  >
                    <ExternalLink size={20} />
                  </button>
                  
                  {/* Fullscreen Toggle */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition duration-150"
                    title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                  </button>
                  
                  {/* Close Button */}
                  <button
                    onClick={() => setShowManual(false)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition duration-150"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
              
              {/* PDF Viewer */}
              <div className="flex-grow overflow-hidden">
                <iframe
                  src={`${manualType === 'admin' ? adminManualPDF : userManualPDF}#view=fitH`}
                  title={`${manualType === 'admin' ? 'Admin' : 'User'} Manual`}
                  className="w-full h-full border-0"
                  style={{ minHeight: '600px' }}
                />
              </div>
              
              {/* Footer */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">SaarthIQ Platform</span> • 
                  <span className="mx-2">|</span>
                  Document version: {manualType === 'admin' ? 'Admin v1.0' : 'User v1.0'}
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      const url = manualType === 'admin' ? adminManualPDF : userManualPDF;
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = manualType === 'admin' ? 'admin-manual.pdf' : 'user-manual.pdf';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 flex items-center gap-2"
                  >
                    <Download size={16} />
                    Download PDF
                  </button>
                  <button
                    onClick={() => setShowManual(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition duration-150"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastNotification && (
          <div className={`fixed bottom-5 right-5 border-l-4 ${
            toastNotification.type === 'success' ? 'border-green-600 bg-green-50' :
            toastNotification.type === 'error' ? 'border-red-600 bg-red-50' :
            toastNotification.type === 'warning' ? 'border-yellow-600 bg-yellow-50' :
            toastNotification.type === 'info' ? 'border-blue-600 bg-blue-50' :
            'border-purple-600 bg-purple-50'
          } shadow-2xl rounded-lg p-4 z-50 animate-slide-in-right flex items-start gap-3 max-w-xs`}>
            {toastNotification.type === 'success' ? (
              <CheckCircle className="text-green-600 w-6 h-6 mt-1 flex-shrink-0" />
            ) : toastNotification.type === 'error' ? (
              <X className="text-red-600 w-6 h-6 mt-1 flex-shrink-0" />
            ) : toastNotification.type === 'warning' ? (
              <AlertCircle className="text-yellow-600 w-6 h-6 mt-1 flex-shrink-0" />
            ) : toastNotification.type === 'info' ? (
              <AlertCircle className="text-blue-600 w-6 h-6 mt-1 flex-shrink-0" />
            ) : (
              <AlertCircle className="text-purple-600 w-6 h-6 mt-1 flex-shrink-0" />
            )}
            <div className="flex-grow">
              <p className="text-sm font-medium text-gray-800">{toastNotification.message}</p>
              {toastNotification.subtext && (
                <p className="text-xs text-gray-600 mt-1">{toastNotification.subtext}</p>
              )}
            </div>
            <button 
              onClick={() => setToastNotification(null)} 
              className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Profile Modal */}
        {isProfileOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6 border-b pb-2">
                  <h2 className="text-2xl font-bold">Profile Settings</h2>
                  <button 
                    onClick={() => setIsProfileOpen(false)} 
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="space-y-4">
                  {['Name', 'Employee ID', 'Phone', 'Email', 'Department'].map((label) => {
                    const key = label === 'Employee ID' ? 'employeeId' : label.toLowerCase();
                    const isReadOnly = !isEditing || key === 'email' || key === 'employeeId' || key === 'department'; 
                    // Department is read-only for non-admin users
                    
                    return (
                      <div key={key} className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                        {isEditing && !isReadOnly ? (
                          key === 'department' ? (
                            // Department is not editable by users - only admins can change this
                            <div className="border px-3 py-2 rounded-lg bg-gray-50 text-gray-800 min-h-[42px] flex items-center">
                              {profile[key] || '-'}
                              <span className="ml-2 text-xs text-gray-500 italic">(Contact admin to change department)</span>
                            </div>
                          ) : (
                            <input
                              type={key === 'phone' ? 'tel' : 'text'}
                              value={profile[key]}
                              onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                              className="w-full border px-3 py-2 rounded-lg bg-white focus:ring-purple-500 focus:border-purple-500 focus:outline-none transition duration-150"
                              maxLength={key === 'phone' ? 15 : undefined}
                            />
                          )
                        ) : (
                          <div className="border px-3 py-2 rounded-lg bg-gray-50 text-gray-800 min-h-[42px] flex items-center">
                            {profile[key] || '-'}
                            {key === 'department' && !isAdmin && (
                              <span className="ml-2 text-xs text-gray-500 italic">(Contact admin to change)</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => {
                            setIsEditing(false);
                            fetchUpdatedProfile(); 
                        }}
                        className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition duration-150 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave} 
                        className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold transition duration-150 shadow-md"
                      >
                        Save Changes
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsProfileOpen(false)}
                        className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition duration-150 font-medium"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold transition duration-150 shadow-md"
                      >
                        Edit Details
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Management Modal */}
        {isUserManagementOpen && (
          <UserManagement 
            onClose={() => {
              setIsUserManagementOpen(false);
              // Refresh notification counts when closing user management
              if (isAdmin) {
                fetchAdminNotificationCounts();
              }
            }} 
            onUserUpdate={() => {
              fetchUpdatedProfile();
              fetchProfileData();
            }}
            onNotificationCountsChange={handleNotificationCountsChange}
          />
        )}
      </main>
    </div>
  );
};

export default Dashboard;
