// src/components/UserManagement.jsx - UPDATED VERSION WITH ENABLE/DISABLE AND EMAIL CONTROL
import React, { useEffect, useState, useCallback } from 'react';
import { 
  User, Shield, X, Check, Edit, RefreshCw, Loader2, Search, 
  Lock, Unlock, AlertCircle, Key, UserX, Settings, MailCheck, 
  MailX, Save, Power, Calendar, Clock, Eye, EyeOff, Mail
} from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const AVAILABLE_DEPARTMENTS = [
  'Business Development', 
  'Recruitment (Franchise)', 
  'Franchise Development',
  'Admin' 
];

const UserManagement = ({ onClose, onUserUpdate, onNotificationCountsChange }) => { 
  const [users, setUsers] = useState([]); 
  const [pendingUsers, setPendingUsers] = useState([]); 
  const [lockedUsers, setLockedUsers] = useState([]);
  const [disabledUsers, setDisabledUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    department: '',
    is_admin: false,
    email_automation_enabled: true
  });
  const [currentTab, setCurrentTab] = useState('allUsers');
  const [searchQuery, setSearchQuery] = useState('');
  const [systemSettings, setSystemSettings] = useState({
    emailAutomation: true
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [enableDisableModal, setEnableDisableModal] = useState({
    isOpen: false,
    user: null,
    action: '', // 'enable' or 'disable'
    duration: '', // 'permanent', '1day', '7days', '30days', 'custom'
    customDate: '',
    reason: ''
  });
  
  const token = localStorage.getItem('token') || '';

  const getCurrentUserId = () => {
    return parseInt(localStorage.getItem('userId'), 10);
  };
  
  // Update parent component with notification counts
  const updateNotificationCounts = useCallback(() => {
    if (onNotificationCountsChange) {
      onNotificationCountsChange({
        pending: pendingUsers.length,
        locked: lockedUsers.length,
        disabled: disabledUsers.length
      });
    }
  }, [pendingUsers.length, lockedUsers.length, disabledUsers.length, onNotificationCountsChange]);
    
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    fetchSystemSettings();
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const fetchSystemSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/users/system/settings`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      if (res.data.success) {
        setSystemSettings(res.data.settings);
      }
    } catch (err) {
      console.error('Error fetching system settings:', err);
    }
  };

  const fetchUsers = useCallback(async () => {
  setLoading(true);
  try {
    // Fetch all users from users table
    const allUsersRes = await axios.get(`${API_BASE_URL}/api/users`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });

    const allFetchedUsers = allUsersRes.data.users || [];
    
    // Apply global email automation setting as override
    const usersWithGlobalOverride = allFetchedUsers.map(user => {
      // If global setting is disabled, override individual user setting
      const effectiveEmailAutomation = systemSettings.emailAutomation 
        ? user.email_automation_enabled 
        : false; // Force false when global is disabled
      
      return {
        ...user,
        // Override the displayed value based on global setting
        email_automation_enabled: effectiveEmailAutomation
      };
    });
    
    // Filter users based on status (use the overridden data)
    const activeUsersList = usersWithGlobalOverride.filter(u => 
      u.is_enabled === 1 && u.is_locked === 0 && u.is_blocked === 0
    );
    
    const lockedUsersList = usersWithGlobalOverride.filter(u => 
      u.is_locked === 1 || u.is_blocked === 1
    );

    const disabledUsersList = usersWithGlobalOverride.filter(u => 
      u.is_enabled === 0
    );
    
    setUsers(activeUsersList);
    setLockedUsers(lockedUsersList);
    setDisabledUsers(disabledUsersList);

      // Fetch pending users separately from pending_users table
      try {
        const pendingRes = await axios.get(`${API_BASE_URL}/api/users/pending-users`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        });
        
        if (pendingRes.data.success) {
          setPendingUsers(pendingRes.data.pendingUsers || []);
        } else {
          setPendingUsers([]);
        }
      } catch (pendingErr) {
        console.error('Error fetching pending users:', pendingErr);
        setPendingUsers([]);
      }

      // Update parent Dashboard with counts
      updateNotificationCounts();
      
    } catch (err) {
      console.error('Error fetching users:', err);
      // Set empty arrays on error
      setUsers([]);
      setPendingUsers([]);
      setLockedUsers([]);
      setDisabledUsers([]);
    } finally {
      setLoading(false);
    }
  }, [token, updateNotificationCounts]);

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token, fetchUsers]);

  const updateSystemSettings = async (key, value) => {
  setSettingsLoading(true);
  try {
    // First update the system setting
    const res = await axios.post(`${API_BASE_URL}/api/users/system/settings`, 
      { key, value },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (res.data.success) {
      // If emailAutomation is being disabled, batch update all users
      if (key === 'emailAutomation' && value === false) {
        try {
          await axios.post(`${API_BASE_URL}/api/users/batch-update-email-automation`, 
            { enabled: false },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          console.log('✅ Batch disabled email automation for all users');
        } catch (batchError) {
          console.error('Batch update error:', batchError);
          // Continue anyway
        }
      }
      
      // If emailAutomation is being enabled, optionally enable for all users
      if (key === 'emailAutomation' && value === true) {
        // Ask admin if they want to enable for all users
        if (window.confirm('Enable email automation for ALL users?')) {
          try {
            await axios.post(`${API_BASE_URL}/api/users/batch-update-email-automation`, 
              { enabled: true },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log('✅ Batch enabled email automation for all users');
          } catch (batchError) {
            console.error('Batch update error:', batchError);
            // Continue anyway
          }
        }
      }
      
      setSystemSettings(prev => ({ ...prev, [key]: value }));
      alert('Settings updated successfully!');
      
      // Refresh users to show updated states
      fetchUsers();
    }
  } catch (err) {
    console.error('Error updating settings:', err);
    alert('Failed to update settings');
  } finally {
    setSettingsLoading(false);
  }
};

  // Open enable/disable modal
  const openEnableDisableModal = (user, action) => {
    setEnableDisableModal({
      isOpen: true,
      user,
      action,
      duration: action === 'disable' ? 'permanent' : 'immediate',
      customDate: '',
      reason: ''
    });
  };

  // Close enable/disable modal
  const closeEnableDisableModal = () => {
    setEnableDisableModal({
      isOpen: false,
      user: null,
      action: '',
      duration: '',
      customDate: '',
      reason: ''
    });
  };

  // Update the handleEnableDisableUser function in UserManagement.jsx
const handleEnableDisableUser = async () => {
  const { user, action, duration, customDate, reason } = enableDisableModal;
  
  if (!user || !action) return;

  try {
    const endpoint = action === 'disable' 
      ? `${API_BASE_URL}/api/users/disable-user` 
      : `${API_BASE_URL}/api/users/enable-user`;
    
    const payload = {
      userId: user.id,
      email: user.email,
      duration: duration === 'custom' ? 'custom' : duration,
      enabledUntil: duration === 'custom' ? customDate : null,
      reason: reason || `${action === 'disable' ? 'Disabled' : 'Enabled'} by admin`,
      actionBy: localStorage.getItem('userEmail') || 'Admin'
    };

    const res = await axios.post(endpoint, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.data.success) {
      alert(`User ${action}d successfully!`);
      fetchUsers();
      updateNotificationCounts();
      closeEnableDisableModal();
    } else {
      // If backend returns success: false but with a message
      alert(res.data.message || `Failed to ${action} user`);
    }
  } catch (err) {
    console.error(`Error ${action}ing user:`, err);
    
    // Check if the user was actually disabled despite the error
    // You could add a specific check here
    if (err.response?.status === 500) {
      // Ask user to refresh to check current status
      if (confirm(`Received server error. The operation may have succeeded. Refresh to check current status?`)) {
        fetchUsers();
        updateNotificationCounts();
      }
    } else {
      alert(err.response?.data?.message || `Failed to ${action} user`);
    }
  }
};

  const handleToggleAdminAccess = async (user) => {
  // Check if trying to toggle self
  if (user.id === getCurrentUserId()) {
    alert("You cannot modify your own admin status.");
    return;
  }
  
  // Check if user is disabled
  if (user.is_enabled === 0) {
    alert("Cannot modify admin access for disabled users. Enable the user first.");
    return;
  }

  const action = user.is_admin ? "Revoke" : "Grant";
  if (!window.confirm(`${action} ADMIN ACCESS for ${user.name}?\n\nThis will ${action.toLowerCase()} full administrative privileges including:\n• User management\n• System settings\n• File management\n• All admin features`)) return;

  try {
    await axios.put(`${API_BASE_URL}/api/users/${user.id}`, {
      is_admin: !user.is_admin
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchUsers();
    alert(`Admin access ${action.toLowerCase()}ed for ${user.name}`);
  } catch (error) {
    alert("Failed to toggle admin access.");
  }
};

 // Toggle email automation for a user
const handleToggleEmailAutomation = async (user) => {
  // Check if global setting is disabled
  if (!systemSettings.emailAutomation) {
    alert('Cannot modify individual email automation when global setting is disabled. Enable it first in System Settings.');
    return;
  }
  
  const newStatus = user.email_automation_enabled ? 0 : 1;
  const action = newStatus ? 'enable' : 'disable';
  
  if (!window.confirm(`${action === 'enable' ? 'Enable' : 'Disable'} email automation for ${user.name}?`)) {
    return;
  }

  try {
    const res = await axios.put(`${API_BASE_URL}/api/users/${user.id}/toggle-email-automation`, {
      email_automation_enabled: newStatus
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.data.success) {
      alert(`Email automation ${action}d for ${user.name}`);
      fetchUsers();
    } else {
      alert(res.data.message || `Failed to ${action} email automation`);
    }
  } catch (error) {
    console.error('Toggle email automation error:', error);
    alert(error.response?.data?.message || `Failed to ${action} email automation`);
  }
};

  const handleEditUser = (user) => {
  setEditingUserId(user.id);
  setEditForm({
    name: user.name || '',
    phone: user.phone || '',
    email: user.email || '',
    department: user.department || '',
    is_admin: user.is_admin || false,
    // Apply global override when editing
    email_automation_enabled: systemSettings.emailAutomation 
      ? (user.email_automation_enabled !== undefined ? user.email_automation_enabled : true)
      : false
  });
};

  const handleUpdateUser = async (id) => {
    try {
      const res = await axios.put(`${API_BASE_URL}/api/users/${id}`, editForm, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });

      alert(res.data.message);
      setEditingUserId(null);
      if (onUserUpdate) onUserUpdate();
      fetchUsers();

    } catch (err) {
      console.error('Update error:', err);
      alert(err.response?.data?.message || 'Failed to update user.');
    }
  };

  const handleApprovalAction = async (userId, action) => {
    if (!window.confirm(`Are you sure you want to ${action} user ID ${userId}? This action is permanent.`)) {
      return;
    }

    setPendingUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, is_processing: true } : u
    ));

    try {
      const res = await axios.post(`${API_BASE_URL}/api/users/approval/${userId}`, { action }, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      
      alert(res.data.message);
      
      // Remove from pending list immediately
      setPendingUsers(prev => prev.filter(user => user.id !== userId));
      
      // Refresh all data
      fetchUsers();
      updateNotificationCounts();

    } catch (err) {
      console.error(`Error ${action} user:`, err);
      alert(err.response?.data?.message || `Failed to ${action} user.`);
      setPendingUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, is_processing: false } : u
      ));
    }
  };

  const handleUnlockAccount = async (user) => {
    if (!window.confirm(`Unlock account for ${user.name} (${user.email})?`)) {
      return;
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/users/unlock-account`, {
        email: user.email,
        unlockedBy: localStorage.getItem('userEmail') || 'Admin'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        alert('Account unlocked successfully!');
        fetchUsers();
        updateNotificationCounts();
      } else {
        alert(res.data.message || 'Failed to unlock account.');
      }
    } catch (err) {
      console.error('Unlock account error:', err);
      alert(err.response?.data?.message || 'Failed to unlock account.');
    }
  };

  const handleBlockAccount = async (user) => {
    if (!window.confirm(`Permanently block account for ${user.name}? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/users/block-account`, {
        email: user.email,
        blockedBy: localStorage.getItem('userEmail') || 'Admin',
        reason: 'Administrative block'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        alert('Account blocked successfully!');
        fetchUsers();
        updateNotificationCounts();
      } else {
        alert(res.data.message || 'Failed to block account.');
      }
    } catch (err) {
      console.error('Block account error:', err);
      alert(err.response?.data?.message || 'Failed to block account.');
    }
  };

  // --- FILTER LOGIC ---
  const filterList = (list) => {
    if (!searchQuery) return list;
    const lowerQuery = searchQuery.toLowerCase();
    
    return list.filter(u => 
        (u.name?.toLowerCase() || '').includes(lowerQuery) ||
        (u.employee_id?.toLowerCase() || '').includes(lowerQuery) ||
        (u.email?.toLowerCase() || '').includes(lowerQuery) ||
        (u.department?.toLowerCase() || '').includes(lowerQuery) ||
        (u.phone?.includes(lowerQuery))
    );
  };

  const filteredUsers = filterList(users);
  const filteredPendingUsers = filterList(pendingUsers);
  const filteredLockedUsers = filterList(lockedUsers);
  const filteredDisabledUsers = filterList(disabledUsers);

  // Format date for display
  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '-';
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Just now';
    try {
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
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      return '-';
    }
  };

  const renderUserRow = (user) => {
    const isEditing = editingUserId === user.id;
    const isSelf = user.id === getCurrentUserId();
    const isDisabled = user.is_enabled === 0;

    let AccessIcon;
let title;
if (user.is_admin) {
    AccessIcon = <Shield className="w-5 h-5 text-purple-600 mx-auto cursor-pointer hover:text-purple-800" />;
    title = "Admin - Click to revoke admin privileges";
} else {
    AccessIcon = <User className="w-5 h-5 text-gray-400 mx-auto cursor-pointer hover:text-gray-600" />;
    title = "Regular User - Click to grant admin privileges";
}

    return (
      <tr 
        key={`approved-${user.id}`} 
        className={`hover:bg-purple-50 transition ${isEditing ? 'bg-purple-100' : ''} ${isDisabled ? 'opacity-60' : ''}`}
        onClick={() => !isEditing && handleEditUser(user)}
      >
        <td className="px-6 py-4 text-sm font-mono text-purple-700 font-bold" onClick={(e) => e.stopPropagation()}>
          {user.employee_id || '-'}
        </td>
        
        <td className="px-6 py-4">
          {isEditing ? (
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({...editForm, name: e.target.value})}
              className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Name"
            />
          ) : (
            <div className="text-sm font-medium text-gray-900">{user.name}</div>
          )}
        </td>
        
        <td className="px-6 py-4">
          {isEditing ? (
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({...editForm, email: e.target.value})}
              className="w-full p-2 border rounded text-sm bg-gray-50"
              placeholder="Email"
              disabled
              title="Email cannot be changed"
            />
          ) : (
            <div className="text-sm text-gray-600">{user.email}</div>
          )}
        </td>
        
        <td className="px-6 py-4">
          {isEditing ? (
            <input
              type="tel"
              value={editForm.phone}
              onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
              className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Phone"
            />
          ) : (
            <div className="text-sm text-gray-600">{user.phone || '-'}</div>
          )}
        </td>
        
        <td className="px-6 py-4">
          {isEditing ? (
            <select 
              value={editForm.department} 
              onChange={(e) => setEditForm({...editForm, department: e.target.value})}
              className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Select Department</option>
              {AVAILABLE_DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-gray-500">{user.department}</div>
          )}
        </td>
        
        <td className="px-6 py-4 text-center" title={title} onClick={(e) => e.stopPropagation()}>
          {isEditing ? (
  <label className="flex items-center justify-center gap-2 text-xs cursor-pointer">
    <input 
      type="checkbox"
      checked={editForm.is_admin}
      onChange={(e) => setEditForm({...editForm, is_admin: e.target.checked})}
      className="form-checkbox h-4 w-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
      disabled={isSelf} 
    />
    Make Admin
  </label>
) : (
  <div onClick={() => !isEditing && handleToggleAdminAccess(user)}>
    {AccessIcon}
  </div>
)}
        </td>

        {/* Email Automation Column */}
<td className="px-6 py-4 text-center">
  {isEditing ? (
    <div>
      {/* Show message when global setting is disabled */}
      {!systemSettings.emailAutomation ? (
        <div className="text-xs text-red-500 italic">
          Disabled globally
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 text-xs cursor-pointer">
          <input 
            type="checkbox"
            checked={editForm.email_automation_enabled}
            onChange={(e) => setEditForm({...editForm, email_automation_enabled: e.target.checked})}
            className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          Email Automation
        </label>
      )}
    </div>
  ) : (
    <div 
      className="flex justify-center"
      onClick={(e) => {
        e.stopPropagation();
        // Only allow toggling if global setting is enabled
        if (systemSettings.emailAutomation) {
          handleToggleEmailAutomation(user);
        } else {
          alert('Email automation is disabled globally. Enable it in System Settings first.');
        }
      }}
    >
      {/* Show global override state */}
      {systemSettings.emailAutomation ? (
        user.email_automation_enabled ? (
          <MailCheck className="w-5 h-5 text-green-600 cursor-pointer hover:text-green-800" 
            title="Email automation enabled - Click to disable" />
        ) : (
          <MailX className="w-5 h-5 text-red-500 cursor-pointer hover:text-red-700" 
            title="Email automation disabled - Click to enable" />
        )
      ) : (
        <MailX className="w-5 h-5 text-gray-400 cursor-not-allowed" 
          title="Email automation disabled globally" />
      )}
    </div>
  )}
</td>
        
        <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {isEditing ? (
            <div className='flex justify-end space-x-2'>
              <button 
                onClick={() => handleUpdateUser(user.id)}
                className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-1 shadow-md"
              >
                <Save className="w-4 h-4" /> Save
              </button>
              <button 
                onClick={() => setEditingUserId(null)}
                className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition shadow-md"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex justify-end space-x-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditUser(user);
                }}
                className="px-3 py-1.5 text-sm rounded-lg hover:bg-purple-700 transition transform hover:scale-105 shadow-md bg-purple-600 text-white flex items-center gap-1"
              >
                <Edit className="w-4 h-4" /> Edit
              </button>
              {user.is_enabled === 1 ? (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    openEnableDisableModal(user, 'disable');
                  }}
                  className="px-3 py-1.5 text-sm rounded-lg hover:bg-orange-700 transition transform hover:scale-105 shadow-md bg-orange-600 text-white flex items-center gap-1"
                  title="Disable User"
                >
                  <Power className="w-4 h-4" /> Disable
                </button>
              ) : (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    openEnableDisableModal(user, 'enable');
                  }}
                  className="px-3 py-1.5 text-sm rounded-lg hover:bg-green-700 transition transform hover:scale-105 shadow-md bg-green-600 text-white flex items-center gap-1"
                  title="Enable User"
                >
                  <Power className="w-4 h-4" /> Enable
                </button>
              )}
            </div>
          )}
        </td>
      </tr>
    );
  };

  const renderPendingUserRow = (user) => {
    return (
      <tr key={`pending-${user.id}`} className={`hover:bg-yellow-50/50 transition ${user.is_processing ? 'opacity-50' : ''}`}>
          <td className="px-6 py-4 text-sm text-gray-400 italic">Pending...</td>
          <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name}</td>
          <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
          <td className="px-6 py-4 text-sm text-gray-600">{user.phone || '-'}</td>
          <td className="px-6 py-4 text-sm text-gray-500">{user.department}</td>
          <td className="px-6 py-4 text-sm text-gray-500">{new Date(user.created_at).toLocaleDateString()}</td>
          <td className="px-6 py-4 text-right whitespace-nowrap">
              {user.is_processing ? (
                  <span className="flex items-center justify-end text-sm text-yellow-600">
                      <Loader2 className="animate-spin w-4 h-4 mr-1" /> Processing...
                  </span>
              ) : (
                  <div className="flex justify-end space-x-2">
                      <button 
                          onClick={() => handleApprovalAction(user.id, 'approve')}
                          className="p-2 text-green-600 hover:text-white hover:bg-green-600 rounded transition shadow-sm"
                          title="Approve User"
                      >
                          <Check className="w-5 h-5" />
                      </button>
                      <button 
                          onClick={() => handleApprovalAction(user.id, 'reject')}
                          className="p-2 text-red-600 hover:text-white hover:bg-red-600 rounded transition shadow-sm"
                          title="Reject/Delete User"
                      >
                          <X className="w-5 h-5" />
                      </button>
                  </div>
              )}
          </td>
      </tr>
    );
  };

  const renderLockedUserRow = (user) => {
    return (
      <tr key={`locked-${user.id}`} className="hover:bg-red-50/50 transition">
        <td className="px-6 py-4 text-sm font-mono text-gray-700 font-bold">{user.employee_id || '-'}</td>
        <td className="px-6 py-4 text-sm font-medium text-gray-900">
          <div className="flex items-center gap-2">
            {user.name}
            {user.is_blocked === 1 ? (
              <UserX className="w-4 h-4 text-red-700" title="Permanently Blocked" />
            ) : (
              <Lock className="w-4 h-4 text-red-500" title="Temporarily Locked" />
            )}
          </div>
        </td>
        <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
        <td className="px-6 py-4 text-sm text-gray-600">{user.phone || '-'}</td>
        <td className="px-6 py-4 text-sm text-gray-500">{user.department}</td>
        <td className="px-6 py-4 text-sm text-gray-500">
          {user.failed_attempts || 0} attempts
        </td>
        <td className="px-6 py-4 text-sm text-gray-500">
          {user.last_failed_attempt ? formatRelativeTime(user.last_failed_attempt) : '-'}
        </td>
        <td className="px-6 py-4 text-sm text-gray-500">
          {user.last_login_ip || user.registered_ip || '-'}
        </td>
        <td className="px-6 py-4 text-right whitespace-nowrap">
          <div className="flex justify-end space-x-2">
            {user.is_blocked !== 1 && (
              <button 
                onClick={() => handleUnlockAccount(user)}
                className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-1 shadow-md"
                title="Unlock Account"
              >
                <Key className="w-4 h-4" /> Unlock
              </button>
            )}
            <button 
              onClick={() => handleBlockAccount(user)}
              className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center gap-1 shadow-md"
              title={user.is_blocked === 1 ? "Account already blocked" : "Permanently Block Account"}
              disabled={user.is_blocked === 1}
            >
              <UserX className="w-4 h-4" /> {user.is_blocked === 1 ? "Blocked" : "Block"}
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderDisabledUserRow = (user) => {
    const isSelf = user.id === getCurrentUserId();
    
    return (
      <tr key={`disabled-${user.id}`} className="hover:bg-gray-50/50 transition">
        <td className="px-6 py-4 text-sm font-mono text-gray-700 font-bold">
          {user.employee_id || '-'}
        </td>
        <td className="px-6 py-4 text-sm font-medium text-gray-900">
          <div className="flex items-center gap-2">
            {user.name}
            <Power className="w-4 h-4 text-gray-500" title="Account Disabled" />
          </div>
        </td>
        <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
        <td className="px-6 py-4 text-sm text-gray-600">{user.phone || '-'}</td>
        <td className="px-6 py-4 text-sm text-gray-500">{user.department}</td>
        <td className="px-6 py-4 text-sm text-gray-500">
          {user.disabled_at ? formatDateTime(user.disabled_at) : '-'}
        </td>
        <td className="px-6 py-4 text-sm text-gray-500">
          {user.enabled_until && user.enabled_until !== '0000-00-00 00:00:00' 
            ? formatDateTime(user.enabled_until) 
            : 'Permanently'}
        </td>
        <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs" title={user.disabled_reason || 'No reason provided'}>
          {user.disabled_reason || '-'}
        </td>
        <td className="px-6 py-4 text-right whitespace-nowrap">
          <div className="flex justify-end space-x-2">
            <button 
              onClick={() => openEnableDisableModal(user, 'enable')}
              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-1 shadow-md"
              title="Enable User"
              disabled={isSelf}
            >
              <Power className="w-4 h-4" /> Enable
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-6 flex justify-between items-center border-b">
            <h2 className="text-3xl font-bold text-gray-800 flex items-center">
              <User className="w-7 h-7 mr-3 text-purple-600" /> 
              User Management
            </h2>
            <div className="flex items-center gap-4">
              <button 
                onClick={onClose} 
                className="text-gray-400 hover:text-gray-600 transition"
                title="Close"
              >
                <X className="w-7 h-7" />
              </button>
            </div>
          </div>

          {/* Controls: Tabs & Search */}
          <div className="p-6 border-b flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex space-x-4 flex-wrap">
                <button
                  onClick={() => setCurrentTab('allUsers')}
                  className={`px-4 py-2 font-semibold transition duration-150 rounded-lg ${
                      currentTab === 'allUsers' 
                      ? 'bg-purple-600 text-white shadow-md' 
                      : 'text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  All Users ({filteredUsers.length + filteredDisabledUsers.length})
                </button>
                
                <button
                  onClick={() => setCurrentTab('disabledUsers')}
                  className={`px-4 py-2 font-semibold transition duration-150 rounded-lg relative ${
                      currentTab === 'disabledUsers' 
                      ? 'bg-gray-600 text-white shadow-md' 
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Power className="w-4 h-4" />
                    Disabled Users
                  </div>
                  {disabledUsers.length > 0 && (
                      <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-bold leading-none text-white bg-gray-600 rounded-full">
                          {disabledUsers.length}
                      </span>
                  )}
                </button>
                
                <button
                  onClick={() => setCurrentTab('pendingUsers')}
                  className={`px-4 py-2 font-semibold transition duration-150 rounded-lg relative ${
                      currentTab === 'pendingUsers' 
                      ? 'bg-yellow-600 text-white shadow-md' 
                      : 'text-yellow-700 hover:bg-yellow-50'
                  }`}
                >
                  Pending Users
                  {pendingUsers.length > 0 && (
                      <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                          {pendingUsers.length}
                      </span>
                  )}
                </button>

                <button
                  onClick={() => setCurrentTab('lockedUsers')}
                  className={`px-4 py-2 font-semibold transition duration-150 rounded-lg relative ${
                      currentTab === 'lockedUsers' 
                      ? 'bg-red-600 text-white shadow-md' 
                      : 'text-red-700 hover:bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Locked Accounts
                  </div>
                  {lockedUsers.length > 0 && (
                      <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                          {lockedUsers.length}
                      </span>
                  )}
                </button>

                <button
                  onClick={() => setCurrentTab('systemSettings')}
                  className={`px-4 py-2 font-semibold transition duration-150 rounded-lg ${
                      currentTab === 'systemSettings' 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    System Settings
                  </div>
                </button>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Search Name, ID, Dept..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-purple-500 focus:border-purple-500 focus:outline-none"
                    />
                </div>
                <button 
                  onClick={fetchUsers} 
                  className="p-2 text-purple-600 hover:text-purple-800 transition disabled:opacity-50 border rounded-lg hover:bg-purple-50 shadow-sm"
                  disabled={loading}
                  title="Refresh All Data"
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                </button>
            </div>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {loading && currentTab !== 'systemSettings' && (
              <div className="flex justify-center items-center py-10 text-gray-500">
                <Loader2 className="animate-spin w-6 h-6 mr-3" /> Loading user data...
              </div>
            )}

            {currentTab === 'allUsers' && !loading && (
              <div className="overflow-x-auto">
                <h3 className="text-xl font-semibold mb-4 text-purple-700">All Users</h3>
                <p className="text-sm text-gray-500 mb-4">Click on any row to edit user details (except Employee ID)</p>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-purple-50">
                      <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Emp ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Phone</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Department</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Admin Access</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Email Auto</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                      {filteredUsers.length > 0 ? filteredUsers.map(renderUserRow) : (
                          <tr><td colSpan="8" className="text-center py-10 text-gray-500">No active users found.</td></tr>
                      )}
                  </tbody>
                </table>
              </div>
            )}

            {currentTab === 'disabledUsers' && !loading && (
              <div className="overflow-x-auto">
                <h3 className="text-xl font-semibold mb-4 text-gray-700">Disabled Users</h3>
                {filteredDisabledUsers.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Emp ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Phone</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Disabled On</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Enabled Until</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Reason</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredDisabledUsers.map(user => renderDisabledUserRow(user))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-10 text-gray-500">
                    <Power className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p>No disabled accounts found.</p>
                  </div>
                )}
              </div>
            )}

            {currentTab === 'pendingUsers' && !loading && (
              <div className="overflow-x-auto">
                <h3 className="text-xl font-semibold mb-4 text-yellow-700">Accounts Pending Approval</h3>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-yellow-50">
                      <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Phone</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Department</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Registered On</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPendingUsers.length > 0 ? filteredPendingUsers.map(renderPendingUserRow) : (
                          <tr><td colSpan="7" className="text-center py-10 text-gray-500">No pending users found.</td></tr>
                      )}
                  </tbody>
                </table>
              </div>
            )}

            {currentTab === 'lockedUsers' && !loading && (
              <div className="overflow-x-auto">
                <h3 className="text-xl font-semibold mb-4 text-red-700">Locked Accounts</h3>
                {filteredLockedUsers.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Emp ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Phone</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Failed Attempts</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Last Attempt</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Last IP</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredLockedUsers.map(user => renderLockedUserRow(user))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-10 text-gray-500">
                    <Lock className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p>No locked accounts found.</p>
                  </div>
                )}
              </div>
            )}

            {currentTab === 'systemSettings' && (
              <div className="max-w-3xl mx-auto">
                <h3 className="text-xl font-semibold mb-6 text-indigo-700">System Settings</h3>
                
                <div className="bg-white rounded-xl shadow-lg border p-6 space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${systemSettings.emailAutomation ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {systemSettings.emailAutomation ? (
                          <MailCheck className="w-6 h-6 text-green-600" />
                        ) : (
                          <MailX className="w-6 h-6 text-gray-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">Global Email Automation</h4>
                        <p className="text-sm text-gray-600">
                          {systemSettings.emailAutomation 
                            ? 'Automated email feature is ENABLED globally' 
                            : 'Automated email feature is DISABLED globally'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {settingsLoading ? (
                        <Loader2 className="animate-spin w-5 h-5 text-blue-600" />
                      ) : (
                        <>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            systemSettings.emailAutomation 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {systemSettings.emailAutomation ? 'Enabled' : 'Disabled'}
                          </span>
                          <button
                            onClick={() => updateSystemSettings('emailAutomation', !systemSettings.emailAutomation)}
                            className={`px-4 py-2 rounded-lg font-medium transition shadow-sm ${
                              systemSettings.emailAutomation
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {systemSettings.emailAutomation ? 'Disable' : 'Enable'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      Important Note
                    </h4>
                    <p className="text-sm text-yellow-700">
                      When Global Email Automation is disabled, the "Automated Email" button will be hidden from ALL users. 
                      Individual user email automation settings can be configured in the "All Users" tab.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t bg-gray-50 text-right">
            <button 
              onClick={onClose} 
              className="px-12 py-3 bg-purple-600 text-white text-lg font-bold rounded-xl hover:bg-purple-700 shadow-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Enable/Disable Modal */}
      {enableDisableModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                {enableDisableModal.action === 'disable' ? (
                  <>
                    <Power className="w-6 h-6 text-orange-600" />
                    Disable User Account
                  </>
                ) : (
                  <>
                    <Power className="w-6 h-6 text-green-600" />
                    Enable User Account
                  </>
                )}
              </h3>
              
              <div className="mb-6">
                <p className="text-gray-600 mb-2">
                  <strong>User:</strong> {enableDisableModal.user?.name} ({enableDisableModal.user?.email})
                </p>
                <p className="text-gray-600">
                  <strong>Employee ID:</strong> {enableDisableModal.user?.employee_id}
                </p>
              </div>

              {enableDisableModal.action === 'disable' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Disable Duration
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEnableDisableModal(prev => ({ ...prev, duration: 'permanent' }))}
                        className={`px-3 py-2 text-sm rounded-lg border ${enableDisableModal.duration === 'permanent' ? 'bg-red-100 border-red-300 text-red-700' : 'border-gray-300 hover:bg-gray-50'}`}
                      >
                        Permanent
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnableDisableModal(prev => ({ ...prev, duration: '1day' }))}
                        className={`px-3 py-2 text-sm rounded-lg border ${enableDisableModal.duration === '1day' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-300 hover:bg-gray-50'}`}
                      >
                        1 Day
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnableDisableModal(prev => ({ ...prev, duration: '7days' }))}
                        className={`px-3 py-2 text-sm rounded-lg border ${enableDisableModal.duration === '7days' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-300 hover:bg-gray-50'}`}
                      >
                        7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnableDisableModal(prev => ({ ...prev, duration: '30days' }))}
                        className={`px-3 py-2 text-sm rounded-lg border ${enableDisableModal.duration === '30days' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-300 hover:bg-gray-50'}`}
                      >
                        30 Days
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Or Custom Date
                    </label>
                    <input
                      type="datetime-local"
                      value={enableDisableModal.customDate}
                      onChange={(e) => setEnableDisableModal(prev => ({ ...prev, duration: 'custom', customDate: e.target.value }))}
                      className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                </>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {enableDisableModal.action === 'disable' ? 'Reason for Disabling' : 'Notes'}
                </label>
                <textarea
                  value={enableDisableModal.reason}
                  onChange={(e) => setEnableDisableModal(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  placeholder={enableDisableModal.action === 'disable' ? 'Enter reason for disabling this account...' : 'Add any notes...'}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeEnableDisableModal}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEnableDisableUser}
                  className={`px-4 py-2 text-sm text-white rounded-lg transition ${enableDisableModal.action === 'disable' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {enableDisableModal.action === 'disable' ? 'Disable Account' : 'Enable Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserManagement;