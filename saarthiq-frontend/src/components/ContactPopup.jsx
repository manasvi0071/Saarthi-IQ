import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Phone, MessageCircle, X, User, AlertTriangle, AlertCircle, Eye, Mail, CheckCircle, Clock, Edit, Save, Camera } from 'lucide-react';

const STATUS_FILTERS = [
  { key: 'in-progress', label: 'In-Progress' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'closed', label: 'Closed' },
  { key: 'follow-up', label: 'Follow-up' },
  { key: 'updated', label: 'Updated' },
];

const getStatusColor = (status) => {
  const colors = {
    'in-progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'cancelled': 'bg-red-100 text-red-800 border-red-200',
    'closed': 'bg-green-100 text-green-800 border-green-200',
    'follow-up': 'bg-blue-100 text-blue-800 border-blue-200',
    'updated': 'bg-purple-100 text-purple-800 border-purple-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
};

const DEPARTMENT_OPTIONS = [
  { key: 'BD', label: 'Business Development (BD)' },
  { key: 'Recruit', label: 'Recruitment (Franchise)' },
  { key: 'Franchise', label: 'Franchise Development' }
];

const LOCATION_OPTIONS = [
  'Mumbai', 'Delhi', 'Kolkata', 'Chennai',
  'Bengaluru', 'Hyderabad', 'Ahmedabad', 'Pune',
  'Gurgaon', 'Noida', 'Surat', 'Vadodara',
  'Kochi', 'Coimbatore', 'Madurai', 'Mysore',
  'Vijayawada', 'Nagpur', 'Indore', 'Jaipur',
  'Lucknow', 'Kanpur', 'Other'
];

// Helper function to convert the raw string value to a padded, clamped string
const formatTimeValue = (value, max) => {
  const current = parseInt(value, 10) || 0;
  const clamped = Math.min(current, max);
  return String(clamped).padStart(2, '0');
}

// IST Date Formatting Functions
const formatDateIST = (dateString) => {
  if (!dateString) return "N/A";
  
  try {
    const date = new Date(dateString);
    // Add 5.5 hours for IST (UTC+5:30)
    const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    
    const day = istDate.getDate().toString().padStart(2, '0');
    const month = (istDate.getMonth() + 1).toString().padStart(2, '0');
    const year = istDate.getFullYear();
    let hours = istDate.getHours();
    const minutes = istDate.getMinutes().toString().padStart(2, '0');
    const seconds = istDate.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours.toString().padStart(2, '0') : '12';
    
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
};

// Also add a simpler version for just date
const formatDateOnlyIST = (dateString) => {
  if (!dateString) return "N/A";
  
  try {
    const date = new Date(dateString);
    // Add 5.5 hours for IST (UTC+5:30)
    const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    
    const day = istDate.getDate().toString().padStart(2, '0');
    const month = (istDate.getMonth() + 1).toString().padStart(2, '0');
    const year = istDate.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
};

// Real-time status update function
const updateActivityStatus = async (activityId, status, token) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/reports/activity/${activityId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.success;
    }
    return false;
  } catch (error) {
    console.error('Error updating status:', error);
    return false;
  }
};

// Update existing activity instead of creating new
const updateExistingActivity = async (activityId, updates, token) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/reports/activity/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        activityId: activityId, 
        ...updates 
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error updating activity:', error);
    return null;
  }
};

// Update candidate details function
const updateCandidateDetails = async (profileId, details, token) => {
  try {
    console.log('📝 Updating candidate details:', { profileId, details });
    
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/remarks/update-candidate-details`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        profile_id: profileId,
        ...details
      }),
    });

    console.log('📝 Update response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Details update successful:', data);
      return data;
    } else {
      const errorData = await response.json();
      console.error('❌ Details update failed:', errorData);
      return null;
    }
  } catch (error) {
    console.error('❌ Error updating candidate details:', error);
    return null;
  }
};

// Email Preview Modal Component
const EmailPreviewModal = ({ profile, showEmailPreview, setShowEmailPreview, sendingEmail, handleSendEmail, emailAutomationEnabled }) => {
  if (!showEmailPreview) return null;

  const candidateName = profile?.candidate_name || profile?.profile_name || profile?.name || "Candidate";
  const candidateEmail = profile?.email || profile?.email_id || profile?.candidate_email || "";
  const employeeName = profile?.user_name || profile?.username || localStorage.getItem("userName") || "Team Member";

  if (!candidateEmail) {
    alert("No email found for this candidate.");
    setShowEmailPreview(false);
    return null;
  }

  if (!emailAutomationEnabled) {
    alert("Email automation feature is currently disabled by admin.");
    setShowEmailPreview(false);
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">
            Email Preview – Profile Update
          </h3>
          <button
            onClick={() => setShowEmailPreview(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 text-sm">
          <div className="mb-1">
            <span className="font-semibold text-gray-700">To: </span>
            <span className="text-gray-800">
              {candidateEmail}
            </span>
          </div>
          <div>
            <span className="font-semibold text-gray-700">Subject: </span>
            <span className="text-gray-800">
              Please update your profile with Talent Corner
            </span>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-gray-50 text-sm text-gray-800 space-y-3">
          <p>
            Hi {candidateName},
          </p>

          <p>
            We hope you are doing well. To help us connect you with the best
            possible opportunities, please take a moment to{" "}
            <span className="font-semibold">update your profile</span> with your
            latest details.
          </p>

          <p>
            <span className="font-semibold">About Us:</span>
            <br />
            Talent Corner H.R. Services Pvt. Ltd. is a professional recruitment
            organization, working with companies across industries to help them
            hire the right talent and support candidates in building their careers.
          </p>

          <p className="text-center">
            <a
              href="https://www.saarthijobs.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-block bg-[#4B2E83] text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-[#3a2366]"
            >
              Update My Details
            </a>
          </p>

          <p>
            If the button above does not work, please copy and paste the following
            link into your browser:
            <br />
            <a
              href="https://www.saarthijobs.com/"
              target="_blank"
              rel="noreferrer"
              className="text-[#4B2E83] underline"
            >
              https://www.saarthijobs.com/
            </a>
          </p>

          <p>
            Regards,
            <br />
            Talent Corner H.R. Services Pvt. Ltd.
            <br />
            {employeeName}
            <br />
            TCHR
          </p>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowEmailPreview(false)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSendEmail}
            disabled={sendingEmail}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${
              sendingEmail
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#4B2E83] hover:bg-[#3a2366]"
            }`}
          >
            {sendingEmail ? "Sending..." : "Send Email"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Candidate Details Edit Modal Component
const CandidateDetailsEditModal = ({ profile, onClose, onSave, currentUser }) => {
  const [editedDetails, setEditedDetails] = useState({
    name: profile?.candidate_name || profile?.profile_name || profile?.name || '',
    phone: profile?.phone || profile?.phone_number || '',
    email: profile?.email || profile?.email_id || '',
    location: profile?.current_location || profile?.candidate_location || '',
    education: profile?.education || profile?.last_education || '',
    company: profile?.company_name || profile?.company || '',
    designation: profile?.designation || '',
    experience: profile?.total_experience || '',
    annual_salary: profile?.annual_salary || profile?.salary_text || '',
    notice_period: profile?.notice_period || '',
    previous_employer: profile?.previous_employer || profile?.previous_company || '',
    key_skills: profile?.key_skills || profile?.skills || '',
  });
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    setEditedDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    
    try {
      await onSave(editedDetails);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50 sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-indigo-800">Edit Candidate Details</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editedDetails.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter candidate name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editedDetails.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editedDetails.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Location</label>
                <select
                  value={editedDetails.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Location</option>
                  {LOCATION_OPTIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
                <input
                  type="text"
                  value={editedDetails.education}
                  onChange={(e) => handleChange('education', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter education"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Company</label>
                <input
                  type="text"
                  value={editedDetails.company}
                  onChange={(e) => handleChange('company', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter company name"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={editedDetails.designation}
                  onChange={(e) => handleChange('designation', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter designation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Experience</label>
                <input
                  type="text"
                  value={editedDetails.experience}
                  onChange={(e) => handleChange('experience', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., 5 Years"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Salary</label>
                <input
                  type="text"
                  value={editedDetails.annual_salary}
                  onChange={(e) => handleChange('annual_salary', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter annual salary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notice Period</label>
                <input
                  type="text"
                  value={editedDetails.notice_period}
                  onChange={(e) => handleChange('notice_period', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter notice period"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Previous Employer</label>
                <input
                  type="text"
                  value={editedDetails.previous_employer}
                  onChange={(e) => handleChange('previous_employer', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter previous employer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key Skills</label>
                <textarea
                  value={editedDetails.key_skills}
                  onChange={(e) => handleChange('key_skills', e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows="3"
                  placeholder="Enter key skills (comma separated)"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-8">
            <button
              onClick={onClose}
              className="px-6 py-3 border-2 border-gray-300 rounded-xl font-medium hover:bg-gray-100 transition"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editedDetails.name.trim()}
              className={`px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg flex items-center gap-2 ${
                (saving || !editedDetails.name.trim()) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ContactPopup = ({ profile, candidateConflict, onClose }) => {
  // Check if it's admin view
  const isAdminView = profile?.is_admin_view || false;
  
  // If it's admin view, show a different interface
  if (isAdminView) {
    return <AdminCandidateHistoryPopup profile={profile} onClose={onClose} />;
  }
  
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailAutomationEnabled, setEmailAutomationEnabled] = useState(true);
  const [realTimeUpdate, setRealTimeUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [candidateName, setCandidateName] = useState(
    profile?.candidate_name || profile?.profile_name || profile?.name || ''
  );
  const [candidateDetails, setCandidateDetails] = useState({});

  const contactProfile = profile || {};
  const contactId = contactProfile.id || contactProfile.profile_id;
  const token = localStorage.getItem('token') || '';
  
  // Get current user info from JWT
  const currentUser = useMemo(() => {
    const token = localStorage.getItem("token")
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]))
        return {
          id: payload.id,
          name: payload.name,
          email: payload.email,
          is_admin: payload.is_admin,
          department: payload.department,
          employee_id: payload.employee_id,
        }
      } catch (e) {
        return null
      }
    }
    return null
  }, []);

  // Fetch email automation setting with special user override
const fetchEmailAutomationSetting = useCallback(async () => {
  if (!token) return;
  
  try {
    // ⭐ SPECIAL USER: Check if current user is the special user
    const SPECIAL_USER_EMAIL = "ailsneha1105@gmail.com";
    
    if (currentUser?.email === SPECIAL_USER_EMAIL) {
      console.log(`✅ SPECIAL ACCESS: Email automation always enabled for ${SPECIAL_USER_EMAIL}`);
      setEmailAutomationEnabled(true);
      return;
    }
    
    // For other users, check the API endpoint
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/email/check-user-permission`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        setEmailAutomationEnabled(data.emailAutomationEnabled);
      }
    } else {
      // Fallback to checking global setting
      const globalResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/users/system/settings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (globalResponse.ok) {
        const globalData = await globalResponse.json();
        if (globalData.success) {
          setEmailAutomationEnabled(globalData.settings.emailAutomation);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching email settings:', error);
    // Default to false on error
    setEmailAutomationEnabled(false);
  }
}, [token, currentUser?.email]);

// Get department for activity
const getDepartmentForActivity = () => {
  if (!currentUser) return '';
  
  const userDept = currentUser.department;
  
  if (userDept === 'Business Development') return 'BD';
  if (userDept === 'Recruitment') return 'Recruit';
  if (userDept === 'Franchise') return 'Franchise';
  if (userDept === 'Admin') {
    return 'BD';
  }
  
  return userDept;
};

// Initialize department for activity logging FIRST
const [department, setDepartment] = useState(() => {
  if (contactProfile.department) {
    const dept = contactProfile.department;
    if (dept === 'Business Development') return 'BD';
    if (dept === 'Recruitment') return 'Recruit';
    if (dept === 'Franchise') return 'Franchise';
    if (dept === 'Admin') {
      if (currentUser?.is_admin) {
        return getDepartmentForActivity();
      }
      return 'BD';
    }
    return dept;
  }
  
  if (currentUser) {
    return getDepartmentForActivity();
  }
  
  return ''; 
});

// Extract conflict data from profile or props
const conflictData = candidateConflict || contactProfile.candidate_conflict;

// Check if there's an active conflict and it's not the current user
// Only relevant for BD department
const hasConflict = conflictData?.active && 
                   conflictData?.user_id !== currentUser?.id &&
                   (department === 'BD' || department === 'Business Development');

  // Initialize Candidate Location from Profile Data
  const [candidateLocation, setCandidateLocation] = useState(() => {
    const pLoc = contactProfile.current_location || contactProfile.candidate_location || '';
    if (!pLoc) return '';

    const match = LOCATION_OPTIONS.find(opt => 
      opt.toLowerCase() === pLoc.toString().trim().toLowerCase()
    );

    return match || 'Other';
  });

  const [status, setStatus] = useState(
  (contactProfile.status || contactProfile.activity_status || 'in-progress').toLowerCase()
);
  const [note, setNote] = useState(contactProfile.note || contactProfile.activity_note || '');

  // Initialize duration from profile
  const [hours, setHours] = useState(() => {
    const duration = contactProfile.duration || contactProfile.activity_duration || '00:00:00';
    return duration.split(':')[0] || '00';
  });
  const [minutes, setMinutes] = useState(() => {
    const duration = contactProfile.duration || contactProfile.activity_duration || '00:00:00';
    return duration.split(':')[1] || '00';
  });
  const [seconds, setSeconds] = useState(() => {
    const duration = contactProfile.duration || contactProfile.activity_duration || '00:00:00';
    return duration.split(':')[2] || '00';
  });

  const [durationError, setDurationError] = useState('');
  const [formError, setFormError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showFullNote, setShowFullNote] = useState({});

  // Handle saving edited candidate details
  const handleSaveCandidateDetails = async (updatedDetails) => {
    try {
      const result = await updateCandidateDetails(contactId, updatedDetails, token);
      
      if (result && result.success) {
        setUpdateMessage('✓ Candidate details updated successfully');
        
        // Update local state
        if (profile) {
          profile.candidate_name = updatedDetails.name;
          profile.profile_name = updatedDetails.name;
          profile.name = updatedDetails.name;
          profile.phone = updatedDetails.phone;
          profile.email = updatedDetails.email;
          profile.current_location = updatedDetails.location;
          profile.education = updatedDetails.education;
          profile.company_name = updatedDetails.company;
          profile.designation = updatedDetails.designation;
          profile.total_experience = updatedDetails.experience;
          profile.annual_salary = updatedDetails.annual_salary;
          profile.notice_period = updatedDetails.notice_period;
          profile.previous_employer = updatedDetails.previous_employer;
          profile.key_skills = updatedDetails.key_skills;
        }
        
        setCandidateName(updatedDetails.name);
        setCandidateLocation(updatedDetails.location);
        
        // Refresh history to show the update activity
        fetchHistory();
        
        setTimeout(() => setUpdateMessage(''), 3000);
      } else {
        throw new Error('Failed to update details');
      }
    } catch (error) {
      console.error('Error updating candidate details:', error);
      throw error;
    }
  };

  const handleOpenEmailPreview = () => {
    const name = candidateName || profile.candidate_name || profile.profile_name || profile.name || "Candidate";
    const email = profile.email || profile.email_id || profile.candidate_email || "";

    if (!email) {
      alert("No email found for this candidate.");
      return;
    }

    if (!emailAutomationEnabled) {
      alert("Email automation feature is currently disabled by admin.");
      return;
    }

    setShowEmailPreview(true);
  };

  const handleSendEmail = async () => {
    // Check if email automation is enabled
    if (!emailAutomationEnabled) {
      alert("Email automation feature is currently disabled by admin.");
      return;
    }
    
    // Check if required fields are filled
    const isBdDepartment = ['BD', 'Business Development'].includes(department);
    
    if (!department) {
      alert("Please select Department before sending email.");
      return;
    }
    
    // For BD: All fields required including duration, status, note, and candidate location
    // For Franchise/Recruit: Only department is required
    if (isBdDepartment) {
      if (!status || !note.trim() || !candidateLocation) {
        alert("For BD department, please fill all required fields (Status, Note, and Candidate Location) before sending email.");
        return;
      }
      
      if (hours === '00' && minutes === '00' && seconds === '00') {
        alert("For BD department, please add call duration before sending email.");
        return;
      }
    }

    try {
      setSendingEmail(true);

      const token = localStorage.getItem("token");
      const candidateEmail = profile.email || profile.email_id || profile.candidate_email;
      const employeeName = profile.user_name || profile.username || localStorage.getItem("userName") || "Team Member";

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/email/send-profile-update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            candidateEmail,
            candidateName,
            employeeName,
            profile_id: contactId,
            user_id: currentUser?.id,
            department: department,
            status: (status || 'in-progress').toLowerCase(),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to send email");
      }

      alert("Email sent successfully.");
      
      // Update existing activity instead of creating new
      const existingActivity = history.find(activity => 
        activity.user_id === currentUser?.id && 
        activity.profile_id === contactId
      );
      
      if (existingActivity) {
        const finalDuration = `${formatTimeValue(hours, 23)}:${formatTimeValue(minutes, 59)}:${formatTimeValue(seconds, 59)}`;
        
        const updates = {
          status: (status || 'in-progress').toLowerCase(),
          duration: finalDuration,
          note: note.trim() || `Email sent to candidate`,
          candidate_location: candidateLocation,
          department: department
        };

        const result = await updateExistingActivity(existingActivity.id, updates, token);
        if (result && result.success) {
          setUpdateMessage('Activity updated with email sent');
          setTimeout(() => setUpdateMessage(''), 3000);
        }
      } else {
        // Create new activity if none exists
        const finalDuration = `${formatTimeValue(hours, 23)}:${formatTimeValue(minutes, 59)}:${formatTimeValue(seconds, 59)}`;
        
        const payload = {
          profile_id: contactId,
          department,
          status: (status || 'in-progress').toLowerCase(),
          duration: finalDuration,
          note: note.trim() || `Email sent to candidate`,
          candidate_location: candidateLocation,
          current_user_id: currentUser?.id,
          current_user_name: currentUser?.name,
          is_admin_user: currentUser?.is_admin || false,
        };

        await fetch(`${import.meta.env.VITE_API_URL}/api/remarks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }

      setShowEmailPreview(false);
      // Refresh history
      fetchHistory();
      setNote('');
      setHours('00');
      setMinutes('00');
      setSeconds('00');
    } catch (err) {
      console.error("Send email error:", err);
      alert("Failed to send email. Please try again.");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleTimeChange = (setter) => (e) => {
    setDurationError('');
    let value = e.target.value.replace(/\D/g, '');
    value = value.slice(0, 2);
    setter(value);
  };

  // Clamps and pads the value only when the user leaves the input field.
  const handleTimeBlur = (value, setter, max) => () => {
    setter(formatTimeValue(value, max));
  };
  
  // TRACK PROFILE CLICK
  const trackProfileClick = useCallback(async () => {
    if (!contactId || !token || !currentUser) return;
    
    try {
      const sessionKey = `click_tracked_${contactId}_${currentUser.id}`;
      if (sessionStorage.getItem(sessionKey)) {
        console.log('Click already tracked in this session');
        return;
      }
      
      await fetch(`${import.meta.env.VITE_API_URL}/api/reports/track-click`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          profile_id: contactId,
          user_id: currentUser.id,
          department: currentUser.department
        }),
      });
      
      sessionStorage.setItem(sessionKey, 'true');
      console.log('Profile click tracked successfully');
    } catch (err) { 
      console.error('Error tracking click:', err); 
    }
  }, [contactId, token, currentUser]);

const fetchHistory = useCallback(async () => {
  if (!contactId) return;
  setHistoryLoading(true);
  try {
    const token = localStorage.getItem('token');
    
    console.log('🔄 Fetching history for profile:', contactId);
    
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/reports/profile-history/${contactId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log('✅ Profile history response:', data);
      
      if (data.success) {
        const historyData = data.data || [];
        
        // Sort by date descending (newest first)
        const sortedHistory = historyData.sort((a, b) => {
          const dateA = new Date(a.created_at || a.created_at_ist || 0);
          const dateB = new Date(b.created_at || b.created_at_ist || 0);
          return dateB - dateA;
        });
        
        // Use already formatted IST times from backend
        const formattedHistory = sortedHistory.map(activity => ({
          ...activity,
          created_at_formatted_ist: activity.created_at_formatted || formatDateIST(activity.created_at),
          created_date_only: formatDateOnlyIST(activity.created_at),
        }));
        
        setHistory(formattedHistory);
        
        // If there's an existing activity by current user, populate form
        const userActivity = sortedHistory.find(act => 
          act.user_id === currentUser?.id
        );
        
        if (userActivity) {
          setStatus(userActivity.status || 'in-progress');
          setNote(userActivity.note || '');
          
          if (userActivity.duration) {
            const [h, m, s] = userActivity.duration.split(':');
            setHours(h || '00');
            setMinutes(m || '00');
            setSeconds(s || '00');
          }
          
          setCandidateLocation(userActivity.candidate_location || '');
          setDepartment(userActivity.department || department);
        } else if (sortedHistory.length > 0) {
          // If no user activity, use the latest activity
          const latestActivity = sortedHistory[0];
          setStatus(latestActivity.status || 'in-progress');
          setNote(latestActivity.note || '');
          
          if (latestActivity.duration) {
            const [h, m, s] = latestActivity.duration.split(':');
            setHours(h || '00');
            setMinutes(m || '00');
            setSeconds(s || '00');
          }
          
          setCandidateLocation(latestActivity.candidate_location || '');
          setDepartment(latestActivity.department || department);
        }
      }
    } else {
      console.log('❌ Profile-history failed');
      setHistory([]);
    }
  } catch (err) { 
    console.error('Error fetching history:', err);
    setHistory([]);
  } finally { 
    setHistoryLoading(false); 
  }
}, [contactId, token, currentUser, department]);

  // Handle real-time status change
  const handleStatusChange = async (newStatus) => {
    if (!currentUser) return;
    
    setStatus(newStatus);
    setRealTimeUpdate(true);
    setUpdateMessage('Updating status in real-time...');
    
    const token = localStorage.getItem('token');
    
    // If there's an existing activity by this user, update it
    const existingActivity = history.find(activity => 
      activity.user_id === currentUser.id && 
      activity.profile_id === contactId
    );
    
    if (existingActivity) {
      const updates = {
        status: newStatus.toLowerCase(),
        duration: `${formatTimeValue(hours, 23)}:${formatTimeValue(minutes, 59)}:${formatTimeValue(seconds, 59)}`,
        note: note.trim(),
        candidate_location: candidateLocation,
        department: department
      };
      
      const result = await updateExistingActivity(existingActivity.id, updates, token);
      if (result && result.success) {
        setUpdateMessage('✓ Status updated in real-time');
        // Refresh history
        setTimeout(() => fetchHistory(), 500);
      } else {
        setUpdateMessage('Failed to update status');
      }
    } else {
      // If no existing activity, just update the status for now
      setUpdateMessage('Status will be saved when you update activity');
    }
    
    setTimeout(() => {
      setRealTimeUpdate(false);
      setTimeout(() => setUpdateMessage(''), 2000);
    }, 2000);
  };

  const handleEditActivity = async (activityId, currentNote) => {
  const newNote = prompt('Edit activity note:', currentNote || '');
  if (newNote === null || newNote.trim() === currentNote) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/reports/activity/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        activityId: activityId, 
        note: newNote.trim() 
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        // Refresh history
        fetchHistory();
        alert('Activity updated successfully!');
      } else {
        throw new Error(data.message || 'Failed to update activity');
      }
    } else {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update activity');
    }
  } catch (error) {
    console.error('Error updating activity:', error);
    alert(`Failed to update activity: ${error.message}`);
  }
};

  const handleDeleteActivity = async (activityId) => {
    if (!confirm('Are you sure you want to delete this activity? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/remarks/${activityId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Refresh history
        fetchHistory();
        alert('Activity deleted successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete activity');
      }
    } catch (error) {
      console.error('Error deleting activity:', error);
      alert(`Failed to delete activity: ${error.message}`);
    }
  };

  // UPDATED useEffect: Track click only when popup opens
  useEffect(() => { 
    if (contactId) {
      // Track profile click when popup opens
      trackProfileClick();
      // Fetch history
      fetchHistory();
      // Fetch email automation setting
      fetchEmailAutomationSetting();
    }
  }, [contactId, trackProfileClick, fetchHistory, fetchEmailAutomationSetting]);

  const handleCancel = () => {
    setSaveStatus(''); 
    setFormError(''); 
    setDurationError(''); 
    onClose();
  };

  const handleSave = async () => {
    setFormError(''); 
    setDurationError('');

    const h = parseInt(formatTimeValue(hours, 23), 10);
    const m = parseInt(formatTimeValue(minutes, 59), 10);
    const s = parseInt(formatTimeValue(seconds, 59), 10);

    setHours(String(h).padStart(2, '0'));
    setMinutes(String(m).padStart(2, '0'));
    setSeconds(String(s).padStart(2, '0'));

    // Check if current department is BD
    const isBdDepartment = ['BD', 'Business Development'].includes(department);
    
    // For BD: All fields are required including duration
    if (isBdDepartment) {
      if (h === 0 && m === 0 && s === 0) {
        setDurationError('Duration cannot be 00:00:00 for BD department');
        return;
      }

      if (!department || !status || !note.trim() || !candidateLocation) {
        setFormError('For BD department, please fill all required fields (Department, Status, Note, and Candidate Location).');
        return;
      }
    } else {
      // For Franchise/Recruit: Only department is required
      if (!department) {
        setFormError('Please select Department.');
        return;
      }
    }

    const finalDuration = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

    setSaveStatus('saving');

    try {
      // Always try to update first
      const updates = {
  profile_id: String(contactId),
  status: (status || 'in-progress').toLowerCase(),
  duration: finalDuration,
  note: note.trim() || 'No note provided',
  candidate_location: candidateLocation || '',
  department: department
};;

      // Try to find if there's an existing activity for this user and profile
      const existingActivity = history.find(activity => 
        activity.user_id === currentUser?.id && 
        activity.profile_id === contactId
      );

      if (existingActivity) {
        // Update existing activity
        const updateResult = await fetch(`${import.meta.env.VITE_API_URL}/api/reports/activity/update`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ 
            activityId: existingActivity.id,
            ...updates 
          }),
        });

        const data = await updateResult.json();
        
        if (data.success) {
          setSaveStatus('success');
          setUpdateMessage('✓ Activity updated successfully');
          // Refresh history
          fetchHistory();
        } else {
          throw new Error(data.message || 'Failed to update activity');
        }
      } else {
        // Create new activity
        const payload = {
          ...updates,
          current_user_id: currentUser?.id,
          current_user_name: currentUser?.name,
          is_admin_user: currentUser?.is_admin || false,
        };

        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/remarks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        
        if (data.success) {
          setSaveStatus('success');
          setUpdateMessage('✓ New activity created');
          fetchHistory();
        } else {
          throw new Error(data.message || 'Failed to create activity');
        }
      }

      // Reset form
      setNote('');
      setHours('00');
      setMinutes('00');
      setSeconds('00');
      
      setTimeout(() => {
        setSaveStatus('');
        setUpdateMessage('');
      }, 1500);
      
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
      setFormError(`Failed to save activity: ${err.message}`);
    }
  };

  // Helper function to safely display data
  const safeDisplay = (value) => {
    if (!value || value.toString().trim() === '') return 'No Data';
    return value;
  };

  const contactData = useMemo(() => ({
    Name: candidateName || contactProfile.name || contactProfile.candidate_name || contactProfile.profile_name || 'No Data',
    Phone: safeDisplay(contactProfile.phone || contactProfile.phone_number || contactProfile.phone),
    Email: safeDisplay(contactProfile.email || contactProfile.email_id || contactProfile.email),
    Location: safeDisplay(contactProfile.current_location || contactProfile.candidate_location),
    Education: safeDisplay(contactProfile.education || contactProfile.last_education),
    Company: safeDisplay(contactProfile.company_name || contactProfile.company),
    Designation: safeDisplay(contactProfile.designation),
    Experience: safeDisplay(contactProfile.total_experience ? `${contactProfile.total_experience} Yrs` : ''),
    AnnualSalary: safeDisplay(contactProfile.annual_salary || contactProfile.salary_text || contactProfile.salary),
    NoticePeriod: safeDisplay(contactProfile.notice_period),
    PreviousEmployer: safeDisplay(contactProfile.previous_employer || contactProfile.previous_company),
    KeySkills: safeDisplay(contactProfile.key_skills || contactProfile.skills),
  }), [contactProfile, candidateName]);

  const titleColor = saveStatus === 'success' ? 'text-green-600' : saveStatus === 'error' ? 'text-red-600' : 'text-indigo-800';

  const getStatusLabel = (key) => STATUS_FILTERS.find(f => f.key === key)?.label || key;

  const toggleFullNote = (index) => {
    setShowFullNote(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Check if current department is BD
  const isBdDepartment = ['BD', 'Business Development'].includes(department);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4" onClick={handleCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <User className="w-7 h-7 text-indigo-600" />
            <div className="flex items-center gap-2">
              <h2 className={`text-2xl font-bold ${titleColor}`}>
                {saveStatus === 'success' ? 'Activity Updated Successfully!' : contactData.Name}
              </h2>
            </div>
          </div>
          <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Real-time update message */}
          {updateMessage && (
            <div className={`p-4 rounded-lg flex items-center gap-3 ${
              updateMessage.includes('✓') 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : updateMessage.includes('Failed')
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              {updateMessage.includes('✓') ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <Clock className="w-5 h-5 text-blue-600" />
              )}
              <span className="font-medium">{updateMessage}</span>
            </div>
          )}

          {/* ✅ CANDIDATE CONFLICT ALERT - Only show for BD department */}
{hasConflict && department === 'BD' && (
  <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg">
    <div className="flex items-center">
      <AlertCircle className="h-5 w-5 text-yellow-500 mr-3" />
      <div>
        <h3 className="text-sm font-medium text-yellow-800">⚠️ Candidate Already Assigned (BD Department Only)</h3>
        <div className="mt-2 text-sm text-yellow-700">
          <p>This candidate is currently being worked on by:</p>
          <div className="mt-1 p-2 bg-yellow-100 rounded">
            <p><strong>User:</strong> {conflictData.user_name} ({conflictData.employee_id})</p>
            <p><strong>Department:</strong> {conflictData.department}</p>
            <p><strong>Status:</strong> {conflictData.status}</p>
            <p><strong>Since:</strong> {formatDateIST(conflictData.last_activity)}</p>
          </div>
          <p className="mt-2 font-medium">Please coordinate with the assigned user before updating this candidate.</p>
        </div>
      </div>
    </div>
  </div>
)}

          {/* Email Automation Status Alert */}
{!emailAutomationEnabled ? (
  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
    <div className="flex items-center">
      <Mail className="h-5 w-5 text-red-500 mr-3" />
      <div>
        <h3 className="text-sm font-medium text-red-800">⚠️ Email Automation Disabled</h3>
        <p className="text-sm text-red-700 mt-1">
          The automated email feature is currently disabled by admin. You cannot send automated emails to candidates.
        </p>
      </div>
    </div>
  </div>
) : currentUser?.email === "ailsneha1105@gmail.com" ? (
  <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-lg">
    <div className="flex items-center">
      <Mail className="h-5 w-5 text-purple-500 mr-3" />
      <div>
        <h3 className="text-sm font-medium text-purple-800">⭐ Special Email Access</h3>
        <p className="text-sm text-purple-700 mt-1">
          You have special permission to send automated emails even when the feature is disabled globally.
        </p>
      </div>
    </div>
  </div>
) : (
  <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
    <div className="flex items-center">
      <Mail className="h-5 w-5 text-green-500 mr-3" />
      <div>
        <h3 className="text-sm font-medium text-green-800">✅ Email Automation Enabled</h3>
        <p className="text-sm text-green-700 mt-1">
          You can send automated emails to candidates.
        </p>
      </div>
    </div>
  </div>
)}

          {/* User Info Banner */}
          {currentUser && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    Logged in as: {currentUser.name} ({currentUser.employee_id})
                  </p>
                  <p className="text-sm text-blue-600">
                    Department: {currentUser.department} {currentUser.is_admin && '(Admin Access)'}
                  </p>
                </div>
                {currentUser.is_admin && (
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    Admin User
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Candidate Info with Edit Button */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 shadow-lg relative">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-indigo-800">Candidate Details</h3>
              <button
                onClick={() => setEditingDetails(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md"
                title="Edit candidate details"
              >
                <Edit className="w-4 h-4" />
                <span className="text-sm font-medium">Edit Details</span>
              </button>
            </div>
            
            <div className="grid md:grid-cols-4 gap-6 text-sm">
              <div className="space-y-3">
                <p><span className="font-semibold">Company:</span> {contactData.Company}</p>
                <p><span className="font-semibold">Designation:</span> {contactData.Designation}</p>
                <p><span className="font-semibold">Experience:</span> {contactData.Experience}</p>
              </div>
              
              <div className="space-y-3">
                <p><span className="font-semibold">Education:</span> {contactData.Education}</p>
                <p><span className="font-semibold">Annual Salary:</span> {contactData.AnnualSalary}</p>
                <p><span className="font-semibold">Notice Period:</span> {contactData.NoticePeriod}</p>
                <p><span className="font-semibold">Location:</span> {contactData.Location}</p>
              </div>
              <div className="space-y-3">
                <p><span className="font-semibold">Previous Employer:</span> {contactData.PreviousEmployer}</p>
                <p><span className="font-semibold">Key Skills:</span> {contactData.KeySkills}</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-indigo-600" /> 
                  <span className="font-mono">{contactData.Phone}</span>
                </div>
                <a 
                  href={`mailto:${contactData.Email}`} 
                  className={`flex items-center gap-3 ${contactData.Email !== 'No Data' ? 'hover:underline text-indigo-600' : 'text-gray-400'}`}
                >
                  <MessageCircle className="w-5 h-5" /> 
                  <span className="break-all">{contactData.Email}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Update Activity Form */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border">
            <h3 className="text-xl font-bold text-indigo-800 mb-6">Update Activity</h3>

            {formError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> {formError}
              </div>
            )}

            {/* Row 1 */}
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
                <select 
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" 
                  value={department} 
                  onChange={e => setDepartment(e.target.value)}
                  disabled={hasConflict && department === 'BD'}
                >
                  <option value="">Select Department</option>
                  {DEPARTMENT_OPTIONS.map(o => {
                    if (o.key === 'Admin' && currentUser?.is_admin) {
                      return null;
                    }
                    return <option key={o.key} value={o.key}>{o.label}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status {isBdDepartment ? '*' : ''}
                </label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_FILTERS.map(f => (
                    <button 
                      key={f.key} 
                      onClick={() => handleStatusChange(f.key)}
                      disabled={hasConflict && department === 'BD'}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition ${status === f.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200'} ${hasConflict && department === 'BD' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Candidate Location {isBdDepartment ? '*' : ''}
                </label>
                <select 
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" 
                  value={candidateLocation} 
                  onChange={e => setCandidateLocation(e.target.value)}
                  disabled={hasConflict && department === 'BD'}
                >
                  <option value="">Select Location</option>
                  {LOCATION_OPTIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </select>
              </div>
            </div>

            {/* Row 2: Duration + Note */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Call Duration (HH:MM:SS) {isBdDepartment ? '*' : ''}
                </label>
                <div className="flex items-center justify-center gap-3">
                  <div className="text-center">
                    <input
                      type="text"
                      maxLength="2"
                      className={`w-12 h-12 text-xl font-mono text-center rounded-lg border-2 border-gray-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all ${hasConflict ? 'opacity-50 cursor-not-allowed' : ''}`}
                      value={hours}
                      onChange={handleTimeChange(setHours)}
                      onBlur={handleTimeBlur(hours, setHours, 23)}
                      onFocus={(e) => e.target.select()}
                      disabled={hasConflict && department === 'BD'}
                    />
                    <p className="text-xs text-gray-500 mt-1">Hours</p>
                  </div>
                  <span className="text-2xl text-gray-400">:</span>
                  <div className="text-center">
                    <input
                      type="text"
                      maxLength="2"
                      className={`w-12 h-12 text-xl font-mono text-center rounded-lg border-2 border-gray-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all ${hasConflict ? 'opacity-50 cursor-not-allowed' : ''}`}
                      value={minutes}
                      onChange={handleTimeChange(setMinutes)}
                      onBlur={handleTimeBlur(minutes, setMinutes, 59)}
                      onFocus={(e) => e.target.select()}
                      disabled={hasConflict && department === 'BD'}
                    />
                    <p className="text-xs text-gray-500 mt-1">Min</p>
                  </div>
                  <span className="text-2xl text-gray-400">:</span>
                  <div className="text-center">
                    <input
                      type="text"
                      maxLength="2"
                      className={`w-12 h-12 text-xl font-mono text-center rounded-lg border-2 border-gray-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all ${hasConflict ? 'opacity-50 cursor-not-allowed' : ''}`}
                      value={seconds}
                      onChange={handleTimeChange(setSeconds)}
                      onBlur={handleTimeBlur(seconds, setSeconds, 59)}
                      onFocus={(e) => e.target.select()}
                      disabled={hasConflict && department === 'BD'}
                    />
                    <p className="text-xs text-gray-500 mt-1">Sec</p>
                  </div>
                </div>
                {durationError && <p className="text-red-600 text-sm mt-3 text-center font-medium">{durationError}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note / Remark {isBdDepartment ? '*' : ''}
                </label>
                <textarea
                  rows="6"
                  className={`w-full p-4 border rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none ${hasConflict ? 'opacity-50 cursor-not-allowed' : ''}`}
                  placeholder="Enter conversation details..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  disabled={hasConflict && department === 'BD'}
                />
              </div>
            </div>

            {saveStatus === 'saving' && (
              <div className="mt-6 text-center p-4 bg-indigo-50 text-indigo-700 rounded-xl font-medium">
                Updating activity...
              </div>
            )}
            
            {saveStatus === 'success' && (
              <div className="mt-6 text-center p-4 bg-green-50 text-green-700 rounded-xl font-medium">
                ✓ Activity updated successfully!
              </div>
            )}
          </div>

          {/* Activity History with Edit/Delete Options */}
          <div className="bg-gray-50 rounded-2xl p-6 border">
            <h3 className="text-xl font-bold text-indigo-800 mb-4">Activity History (IST Time)</h3>
            {historyLoading ? (
              <p className="text-center text-gray-500 py-8">Loading activity history...</p>
            ) : history.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No activities logged yet. Be the first to log an activity!</p>
            ) : (
              <div className="space-y-4">
                {history.map((r, i) => {
                  const isOwnActivity = r.user_id === currentUser?.id;
                  
                  // Use the formatted IST date
                  const displayDate = r.created_at_formatted_ist || 
                                     r.created_at_formatted || 
                                     formatDateIST(r.created_at) || 
                                     "Date not available";
                  
                  return (
                    <div key={i} className="bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(r.status)}`}>
                            {getStatusLabel(r.status)}
                          </span>
                          <span className="text-sm font-medium text-gray-600">
                            {DEPARTMENT_OPTIONS.find(d => d.key === r.department)?.label || r.department}
                          </span>
                          {r.is_admin && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              Admin
                            </span>
                          )}
                          {isOwnActivity && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              Your Activity
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-indigo-600">{r.duration || '00:00:00'}</span>
                      </div>
                      
                      <p className="text-xs text-gray-500 mb-1">
                        Candidate Location: <span className="font-medium">{r.candidate_location || 'Not specified'}</span>
                      </p>
                      
                      <div className="mt-2">
                        <p className="text-gray-700 text-sm">
                          {showFullNote[i] || r.note?.length <= 150 ? r.note : `${r.note?.substring(0, 150)}...`}
                          {r.note?.length > 150 && (
                            <button 
                              onClick={() => toggleFullNote(i)}
                              className="ml-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                            >
                              {showFullNote[i] ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </p>
                      </div>
                      
                      <div className="flex justify-between items-center mt-3">
                        <div>
                          <p className="text-xs text-gray-500">
                            Updated by: {r.user_name || 'Unknown'} ({r.employee_id || 'N/A'})
                          </p>
                          <p className="text-xs text-gray-500">
                            Date: {displayDate}
                          </p>
                        </div>
                        
                        {isOwnActivity && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditActivity(r.id, r.note)}
                              className="text-xs px-3 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition"
                              title="Edit your activity"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteActivity(r.id)}
                              className="text-xs px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 transition"
                              title="Delete your activity"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex justify-end gap-4">
          <button onClick={handleCancel} className="px-8 py-3 border-2 border-gray-300 rounded-xl font-medium hover:bg-gray-100 transition">
            Cancel
          </button>
          {emailAutomationEnabled && (
            <button
              onClick={handleOpenEmailPreview}
              className="px-4 py-2 rounded-lg bg-[#4B2E83] text-white text-sm font-semibold hover:bg-[#3a2366] transition-colors"
            >
              Automated Email
            </button>
          )}
          <button 
  onClick={handleSave} 
  disabled={saveStatus === 'saving' || (hasConflict && department === 'BD')}
  className={`px-10 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg ${saveStatus === 'saving' || (hasConflict && department === 'BD') ? 'opacity-50 cursor-not-allowed' : ''}`}
>
  {saveStatus === 'saving' ? 'Updating...' : 'Update Activity'}
</button>
        </div>
      </div>

      {/* Email Preview Modal */}
      <EmailPreviewModal 
        profile={profile}
        showEmailPreview={showEmailPreview}
        setShowEmailPreview={setShowEmailPreview}
        sendingEmail={sendingEmail}
        handleSendEmail={handleSendEmail}
        emailAutomationEnabled={emailAutomationEnabled}
      />

      {/* Candidate Details Edit Modal */}
      {editingDetails && (
        <CandidateDetailsEditModal
          profile={profile}
          onClose={() => setEditingDetails(false)}
          onSave={handleSaveCandidateDetails}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

// Admin Candidate History Popup Component
const AdminCandidateHistoryPopup = ({ profile, onClose }) => {
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailAutomationEnabled, setEmailAutomationEnabled] = useState(true);
  const [editingDetails, setEditingDetails] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  
  // Get current user from token
  const currentUser = useMemo(() => {
    const token = localStorage.getItem("token")
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]))
        return {
          id: payload.id,
          name: payload.name,
          email: payload.email,
          is_admin: payload.is_admin,
          department: payload.department,
          employee_id: payload.employee_id,
        }
      } catch (e) {
        return null
      }
    }
    return null
  }, []);

  // Fetch email automation setting
  const fetchEmailAutomationSetting = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users/system/settings`, {
        headers: { 'Authorization': `Bearer ${token}` },
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
  }, []);

  // Handle saving edited candidate details
  const handleSaveCandidateDetails = async (updatedDetails) => {
    const profileId = profile.profile_id || profile.id;
    const token = localStorage.getItem('token');
    
    try {
      const result = await updateCandidateDetails(profileId, updatedDetails, token);
      
      if (result && result.success) {
        setUpdateMessage('✓ Candidate details updated successfully');
        
        // Update local profile object
        if (profile) {
          profile.candidate_name = updatedDetails.name;
          profile.profile_name = updatedDetails.name;
          profile.name = updatedDetails.name;
          profile.phone = updatedDetails.phone;
          profile.email = updatedDetails.email;
          profile.current_location = updatedDetails.location;
          profile.education = updatedDetails.education;
          profile.company_name = updatedDetails.company;
          profile.designation = updatedDetails.designation;
          profile.total_experience = updatedDetails.experience;
          profile.annual_salary = updatedDetails.annual_salary;
          profile.notice_period = updatedDetails.notice_period;
          profile.previous_employer = updatedDetails.previous_employer;
          profile.key_skills = updatedDetails.key_skills;
        }
        
        setTimeout(() => setUpdateMessage(''), 3000);
      } else {
        throw new Error('Failed to update details');
      }
    } catch (error) {
      console.error('Error updating candidate details:', error);
      throw error;
    }
  };

  const fetchAdminHistory = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const profileId = profile.profile_id || profile.id;
      
      // Fetch all activities for this profile with IST time
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/reports/profile-history/${profileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const historyData = data.data || [];
          
          // Sort by date descending (newest first)
          const sortedHistory = historyData.sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
          );
          
          // Format dates to IST
          const formattedHistory = sortedHistory.map(activity => ({
            ...activity,
            created_at_formatted_ist: activity.created_at_formatted || formatDateIST(activity.created_at),
            created_date_only: formatDateOnlyIST(activity.created_at),
          }));
          
          setCallHistory(formattedHistory);
        } else {
          // Fallback to profile data
          const fallbackData = profile.candidate_call_history || [];
          setCallHistory(fallbackData);
        }
      } else {
        // Fallback to profile data
        const fallbackData = profile.candidate_call_history || [];
        setCallHistory(fallbackData);
      }
    } catch (error) {
      console.error('Error fetching admin history:', error);
      setCallHistory(profile.candidate_call_history || []);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const handleOpenEmailPreview = () => {
    const name = profile?.candidate_name || profile?.profile_name || profile?.name || "Candidate";
    const email = profile?.email || profile?.email_id || profile?.candidate_email || "";

    if (!email) {
      alert("No email found for this candidate.");
      return;
    }

    if (!emailAutomationEnabled) {
      alert("Email automation feature is currently disabled by admin.");
      return;
    }

    setShowEmailPreview(true);
  };

  const handleSendEmail = async () => {
    // Check if email automation is enabled
    if (!emailAutomationEnabled) {
      alert("Email automation feature is currently disabled by admin.");
      return;
    }

    try {
      setSendingEmail(true);

      const token = localStorage.getItem("token");
      const candidateEmail = profile.email || profile.email_id || profile.candidate_email;
      const employeeName = profile.user_name || profile.username || localStorage.getItem("userName") || "Team Member";

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/email/send-profile-update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            candidateEmail,
            candidateName: name,
            employeeName,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to send email");
      }

      alert("Email sent successfully.");
      setShowEmailPreview(false);
    } catch (err) {
      console.error("Send email error:", err);
      alert("Failed to send email. Please try again.");
    } finally {
      setSendingEmail(false);
    }
  };

  useEffect(() => {
    fetchAdminHistory();
    fetchEmailAutomationSetting();
  }, [fetchAdminHistory, fetchEmailAutomationSetting]);

  const handleEditActivity = async (activityId, currentNote) => {
    const activity = callHistory.find(a => a.id === activityId);
    if (!activity) {
      alert('Activity not found!');
      return;
    }

    // Only allow editing own activities
    if (activity.user_id !== currentUser?.id) {
      alert('You can only edit your own activities.');
      return;
    }

    const newNote = prompt('Edit activity note:', currentNote || '');
    if (newNote === null || newNote.trim() === currentNote) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/remarks/${activityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note: newNote.trim() }),
      });

      if (response.ok) {
        // Refresh data
        fetchAdminHistory();
        alert('Activity updated successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update activity');
      }
    } catch (error) {
      console.error('Error updating activity:', error);
      alert(`Failed to update activity: ${error.message}`);
    }
  };

  const handleDeleteActivity = async (activityId) => {
    const activity = callHistory.find(a => a.id === activityId);
    if (!activity) {
      alert('Activity not found!');
      return;
    }

    // Only allow deleting own activities
    if (activity.user_id !== currentUser?.id) {
      alert('You can only delete your own activities.');
      return;
    }

    if (!confirm('Are you sure you want to delete this activity? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/remarks/${activityId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Remove from local state
        setCallHistory(prev => prev.filter(act => act.id !== activityId));
        alert('Activity deleted successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete activity');
      }
    } catch (error) {
      console.error('Error deleting activity:', error);
      alert(`Failed to delete activity: ${error.message}`);
    }
  };

  const getStatusLabel = (key) => STATUS_FILTERS.find(f => f.key === key)?.label || key;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-indigo-800">
                Candidate Call History: {profile?.candidate_name || profile?.profile_name || profile?.name || "Unknown"}
              </h2>
              <button
                onClick={() => setEditingDetails(true)}
                className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded-lg transition"
                title="Edit candidate details"
              >
                <Edit className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600">
              Employee: {profile.user_name} ({profile.employee_id}) • 
              Department: {profile.department} • 
              Total Calls: {callHistory.length}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Update Message */}
        {updateMessage && (
          <div className="mx-4 mt-4 p-3 bg-green-50 text-green-800 rounded-lg flex items-center gap-2 border border-green-200">
            <CheckCircle className="w-5 h-5" />
            <span>{updateMessage}</span>
          </div>
        )}

        {/* Email Automation Status Alert */}
{!emailAutomationEnabled ? (
  <div className="bg-red-50 border-l-4 border-red-500 p-4 m-4 rounded-lg">
    <div className="flex items-center">
      <Mail className="h-5 w-5 text-red-500 mr-3" />
      <div>
        <h3 className="text-sm font-medium text-red-800">⚠️ Email Automation Disabled</h3>
        <p className="text-sm text-red-700 mt-1">
          The automated email feature is currently disabled by admin.
        </p>
      </div>
    </div>
  </div>
) : currentUser?.email === "ailsneha1105@gmail.com" ? (
  <div className="bg-purple-50 border-l-4 border-purple-500 p-4 m-4 rounded-lg">
    <div className="flex items-center">
      <Mail className="h-5 w-5 text-purple-500 mr-3" />
      <div>
        <h3 className="text-sm font-medium text-purple-800">⭐ Special Email Access (Admin View)</h3>
        <p className="text-sm text-purple-700 mt-1">
          You have special permission to send automated emails even when the feature is disabled globally.
        </p>
      </div>
    </div>
  </div>
) : (
  <div className="bg-green-50 border-l-4 border-green-500 p-4 m-4 rounded-lg">
    <div className="flex items-center">
      <Mail className="h-5 w-5 text-green-500 mr-3" />
      <div>
        <h3 className="text-sm font-medium text-green-800">✅ Email Automation Enabled (Admin View)</h3>
        <p className="text-sm text-green-700 mt-1">
          You can send automated emails to candidates.
        </p>
      </div>
    </div>
  </div>
)}
        {/* Current User Info Banner */}
        {currentUser && (
          <div className="bg-blue-50 border border-blue-200 p-4 m-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Logged in as Admin: {currentUser.name} ({currentUser.employee_id})
                </p>
                <p className="text-sm text-blue-600">
                  You can only edit or delete your own activities
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Call History Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading activity history...</p>
            </div>
          ) : callHistory.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No activity history found for this candidate.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Date & Time (IST)</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Duration</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Department</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Note</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Employee</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {callHistory.map((activity) => {
                    const isOwnActivity = activity.user_id === currentUser?.id;
                    const displayDate = activity.created_at_formatted_ist || 
                                       formatDateIST(activity.created_at) || 
                                       "N/A";
                    
                    return (
                      <tr key={activity.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">
                          {displayDate}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold">
                          {activity.duration || "00:00:00"}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(activity.status)}`}>
                            {getStatusLabel(activity.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {DEPARTMENT_OPTIONS.find(d => d.key === activity.department)?.label || activity.department}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700 max-w-md">
                          {activity.note || "-"}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <div>
                            <div>{activity.user_name || "Unknown"}</div>
                            <div className="text-xs text-gray-500">{activity.employee_id || "N/A"}</div>
                            {isOwnActivity && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full mt-1 inline-block">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {isOwnActivity ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditActivity(activity.id, activity.note)}
                                className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition"
                                title="Edit this activity"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteActivity(activity.id)}
                                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
                                title="Delete this activity"
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">View only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex justify-end gap-4">
          <button onClick={onClose} className="px-8 py-3 border-2 border-gray-300 rounded-xl font-medium hover:bg-gray-100 transition">
            Cancel
          </button>
          {emailAutomationEnabled && (
            <button
              onClick={handleOpenEmailPreview}
              className="px-4 py-2 rounded-lg bg-[#4B2E83] text-white text-sm font-semibold hover:bg-[#3a2366] transition-colors"
            >
              Automated Email
            </button>
          )}
        </div>
      </div>

      {/* Email Preview Modal */}
      <EmailPreviewModal 
        profile={profile}
        showEmailPreview={showEmailPreview}
        setShowEmailPreview={setShowEmailPreview}
        sendingEmail={sendingEmail}
        handleSendEmail={handleSendEmail}
        emailAutomationEnabled={emailAutomationEnabled}
      />

      {/* Candidate Details Edit Modal */}
      {editingDetails && (
        <CandidateDetailsEditModal
          profile={profile}
          onClose={() => setEditingDetails(false)}
          onSave={handleSaveCandidateDetails}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default ContactPopup;
