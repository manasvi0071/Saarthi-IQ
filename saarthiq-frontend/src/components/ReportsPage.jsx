import { useState, useEffect, useRef, useCallback } from "react"
import {
  BarChart3,
  Users,
  Clock,
  Target,
  Download,
  TrendingUp,
  MapPin,
  User,
  Search,
  Eye,
  X,
  Home,
  RefreshCw,
  Filter,
  MessageSquare,
  Mail,
  Calendar,
  MousePointer,
  LineChart,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Edit,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import ContactPopup from "./ContactPopup"

// Add fetchWithRetry utility function
const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      if (i === retries - 1) throw new Error(`HTTP ${response.status}`);
      
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
};

// Helper function to format date in IST
const formatDateIST = (dateString, fallbackString = null) => {
  const dateToFormat = dateString || fallbackString;
  
  if (!dateToFormat || dateToFormat === "N/A" || dateToFormat === "null" || dateToFormat === "undefined" || dateToFormat === null) {
    return "N/A";
  }
  
  try {
    let date;
    
    if (dateToFormat instanceof Date) {
      date = dateToFormat;
    } else {
      date = new Date(dateToFormat);
      
      if (isNaN(date.getTime())) {
        const cleanDate = dateToFormat
          .replace('T', ' ')
          .replace('Z', '')
          .split('.')[0];
        date = new Date(cleanDate + ' UTC');
      }
    }
    
    if (isNaN(date.getTime())) {
      return "N/A";
    }
    
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);
    
    const day = istDate.getUTCDate().toString().padStart(2, '0');
    const month = (istDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = istDate.getUTCFullYear();
    
    let hours = istDate.getUTCHours();
    const minutes = istDate.getUTCMinutes().toString().padStart(2, '0');
    const seconds = istDate.getUTCSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours.toString().padStart(2, '0') : '12';
    
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;
  } catch (error) {
    return "N/A";
  }
};

// Helper function to format date only
const formatDateOnlyIST = (dateString) => {
  if (!dateString) return "N/A";
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "N/A";
    
    const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    
    const day = istDate.getUTCDate().toString().padStart(2, '0');
    const month = (istDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = istDate.getUTCFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    return dateString;
  }
};

// Helper function to format date for graph labels
const formatDateForGraph = (dateString, period) => {
  if (!dateString) return "N/A";
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    
    if (period === 'daily') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = days[istDate.getUTCDay()];
      const day = istDate.getUTCDate();
      return `${dayName} ${day}`;
    } else if (period === 'weekly') {
      const weekNumber = Math.ceil((istDate.getUTCDate() + (new Date(istDate.getUTCFullYear(), istDate.getUTCMonth(), 1).getUTCDay() - 1)) / 7);
      return `Week ${weekNumber}`;
    } else if (period === 'monthly') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months[istDate.getUTCMonth()];
    } else if (period === 'quarterly') {
      const quarter = Math.floor(istDate.getUTCMonth() / 3) + 1;
      return `Q${quarter}`;
    } else if (period === 'yearly') {
      return istDate.getUTCFullYear().toString();
    }
    
    return `${istDate.getUTCDate()}/${istDate.getUTCMonth() + 1}`;
  } catch (error) {
    return dateString;
  }
};

const ReportsPage = () => {
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  
  // TIME PERIOD FILTER
  const [timePeriod, setTimePeriod] = useState("all")
  const [customDateRange, setCustomDateRange] = useState(null)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  
  // Location details state
  const [showLocationDetails, setShowLocationDetails] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationDetailsData, setLocationDetailsData] = useState([]);
  const [locationDetailsLoading, setLocationDetailsLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState("overview")
  const [user] = useState(() => {
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
  })

  const [selectedDept, setSelectedDept] = useState(user?.is_admin ? "all" : user?.department)
  const [searchQuery, setSearchQuery] = useState("")
  const [exporting, setExporting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const searchTimeoutRef = useRef(null)
  const adminSearchInputRef = useRef(null)  // ADD THIS LINE
  
  const [filteredUsers, setFilteredUsers] = useState([])
  // Ref to preserve caret position in Updated Candidates search input
  const updatedCandidatesSearchRef = useRef(null)
  const [filteredActivities, setFilteredActivities] = useState([])
  
  // State for updated candidates report
  const [showUpdatedCandidates, setShowUpdatedCandidates] = useState(false)
  const [updatedCandidatesData, setUpdatedCandidatesData] = useState([])
  const [updatedCandidatesLoading, setUpdatedCandidatesLoading] = useState(false)
  const [updatedCandidatesUserFilter, setUpdatedCandidatesUserFilter] = useState("all")
  const [updatedCandidatesSearch, setUpdatedCandidatesSearch] = useState("")

  // State for click counts data
  const [clickCountsData, setClickCountsData] = useState([]);
  const [clickCountsLoading, setClickCountsLoading] = useState(false);
  const [clickCountsPeriod, setClickCountsPeriod] = useState("daily");
  const [clickCountsTrend, setClickCountsTrend] = useState([]);
  const formatTrendData = (trend) => {
    if (!trend) return []
    const step = Math.ceil(trend.length / 5)
    return trend.map((item, index) => ({
      ...item,
      showLabel: index % step === 0
    }))
  }
  const trendFormatted = formatTrendData(clickCountsTrend)
  const [sortConfig, setSortConfig] = useState({ key: 'total_clicks', direction: 'desc' });
  const clickCountsFetchedRef = useRef(false);

  // State for login statistics data
  const [loginData, setLoginData] = useState({
    total_logins: 0,
    total_logins_today: 0,
    avg_daily_logins: 0,
    users: []
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginPeriod, setLoginPeriod] = useState("daily");
  const [loginSearch, setLoginSearch] = useState("");
  const [loginSortConfig, setLoginSortConfig] = useState({ key: 'login_count', direction: 'desc' });
  const [todayLogins, setTodayLogins] = useState([]);
  const [todayLoginsLoading, setTodayLoginsLoading] = useState(false);

  // State for popups
  const [showUserLogs, setShowUserLogs] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [userActivities, setUserActivities] = useState([])
  const [showAllLogs, setShowAllLogs] = useState(false)
  const [showContactPopup, setShowContactPopup] = useState(false)
  const [selectedContact, setSelectedContact] = useState(null)
  const [contactLoading, setContactLoading] = useState(false)

  // State for user logs search
  const [userLogsSearch, setUserLogsSearch] = useState("")
  const [userLogsStatus, setUserLogsStatus] = useState("all")

  // State for candidate conflict alert
  const [candidateConflict, setCandidateConflict] = useState(null)

  // State for viewed profiles popup
  const [showViewedProfiles, setShowViewedProfiles] = useState(false)
  const [viewedProfilesData, setViewedProfilesData] = useState(null)
  const [viewedProfilesLoading, setViewedProfilesLoading] = useState(false)
  const [selectedUserForViews, setSelectedUserForViews] = useState(null)

  // State for candidate call logs popup
  const [showCandidateLogs, setShowCandidateLogs] = useState(false)
  const [selectedCandidateLogs, setSelectedCandidateLogs] = useState(null)

  // Normalize call log entries whenever candidate logs are loaded
  useEffect(() => {
    if (!selectedCandidateLogs || !Array.isArray(selectedCandidateLogs.call_logs)) return
    const normalized = selectedCandidateLogs.call_logs.map((log) => ({
      ...log,
      note: log.note || log.notes || "",
      notes: log.notes || log.note || "",
      candidate_location: log.candidate_location || log.current_location || "—"
    }))
    if (JSON.stringify(normalized) !== JSON.stringify(selectedCandidateLogs.call_logs)) {
      setSelectedCandidateLogs(prev => ({ ...prev, call_logs: normalized }))
    }
  }, [selectedCandidateLogs])

  // State for email logs
  const [emailLogs, setEmailLogs] = useState([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);
  const [emailSearch, setEmailSearch] = useState("");
  const emailFetchedRef = useRef(false);

  // State for location data
  const [locationData, setLocationData] = useState([]);
  const [locationStatsLoading, setLocationStatsLoading] = useState(false);

  // State for real-time updates
  const [lastUpdate, setLastUpdate] = useState(null)

  const navigate = useNavigate()
  const API_URL = import.meta.env.VITE_API_URL || "https://api.saarthiq.in"

  // Helper function to get date range based on time period
  const getDateRangeFromPeriod = useCallback((period) => {
    const now = new Date();
    const endDateISO = now.toISOString().split('T')[0];
    let startDateISO;
    
    switch(period) {
      case '60days':
        startDateISO = new Date(now.setDate(now.getDate() - 60)).toISOString().split('T')[0];
        break;
      case '90days':
        startDateISO = new Date(now.setDate(now.getDate() - 90)).toISOString().split('T')[0];
        break;
      case '365days':
        startDateISO = new Date(now.setDate(now.getDate() - 365)).toISOString().split('T')[0];
        break;
      case 'all':
        startDateISO = '2020-01-01';
        break;
      case '7days':
        startDateISO = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
        break;
      default:
        startDateISO = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
    }
    
    return { startDate: startDateISO, endDate: endDateISO };
  }, []);

  // Fetch updated candidates data
  const fetchUpdatedCandidates = useCallback(async (forcedUserId) => {
    try {
      setUpdatedCandidatesLoading(true);
      const token = localStorage.getItem("token");
      
      let dateParams = {};
      if (customDateRange) {
        dateParams = customDateRange;
      } else {
        dateParams = getDateRangeFromPeriod(timePeriod);
      }
      
      let uid = forcedUserId ?? updatedCandidatesUserFilter;
      let url = new URL(`${API_URL}/api/reports/updated-candidates`);
      url.searchParams.append('startDate', dateParams.startDate);
      url.searchParams.append('endDate', dateParams.endDate);
      if (uid && uid !== "all") {
        url.searchParams.append('user_id', uid);
      }
      if (user?.is_admin && selectedDept && selectedDept !== "all") {
        url.searchParams.append('department', selectedDept);
      }
      
      const response = await fetchWithRetry(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUpdatedCandidatesData(data.data || []);
        }
      }
    } catch (err) {
      console.error("Error fetching updated candidates:", err);
    } finally {
      setUpdatedCandidatesLoading(false);
    }
  }, [API_URL, user, selectedDept, timePeriod, customDateRange, updatedCandidatesUserFilter, getDateRangeFromPeriod]);

  // Ensure per-user filter refreshes when the filter changes
  useEffect(() => {
    if (showUpdatedCandidates) {
      fetchUpdatedCandidates();
    }
  }, [updatedCandidatesUserFilter, showUpdatedCandidates, timePeriod, customDateRange, selectedDept, fetchUpdatedCandidates]);

  // Fetch report data with time period filter
  const fetchReportData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      
      let dateParams = {};
      if (customDateRange) {
        dateParams = customDateRange;
      } else {
        dateParams = getDateRangeFromPeriod(timePeriod);
      }
      
      const deptParam = user?.is_admin ? (selectedDept || "all") : user?.department || "all";
      
      let apiDeptParam = deptParam;
      if (apiDeptParam === "BD") apiDeptParam = "Business Development";
      if (apiDeptParam === "Recruit") apiDeptParam = "Recruitment";
      if (apiDeptParam === "Franchise") apiDeptParam = "Franchise";
      if (apiDeptParam === "all") apiDeptParam = "all";
      
      const url = new URL(`${API_URL}/api/reports/dashboard`);
      url.searchParams.append('department', apiDeptParam);
      url.searchParams.append('startDate', dateParams.startDate);
      url.searchParams.append('endDate', dateParams.endDate);
      
      if (!user?.is_admin) {
        url.searchParams.append('user_id', user.id);
      }
      
      const response = await fetchWithRetry(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to fetch report data");

      const data = await response.json();
      if (data.success) {
        setReportData(data.data);
        if (data.success) {
  setReportData(data.data);
  setSearchQuery("");
  
  if (!user?.is_admin) {
    // For non-admin, fetch ALL activities for this user, not just recent ones
    const allActivities = data.data.recentActivities || [];
    const latestActivities = getLatestActivitiesPerCandidate(allActivities);
    setFilteredActivities(latestActivities);
  } else {
    setFilteredUsers(data.data.userPerformance || []);
    setFilteredActivities(data.data.recentActivities || []);
  }
  
  setLastUpdate(new Date());
}
        setSearchQuery("");
        
        if (!user?.is_admin) {
          const latestActivities = getLatestActivitiesPerCandidate(data.data.recentActivities || []);
          setFilteredActivities(latestActivities);
        } else {
          setFilteredUsers(data.data.userPerformance || []);
          setFilteredActivities(data.data.recentActivities || []);
        }
        
        setLastUpdate(new Date());
      } else {
        throw new Error(data.message || "Failed to load report data");
      }
    } catch (err) {
      setError(err.message);
      console.error("Error fetching report data:", err);
    } finally {
      setLoading(false);
    }
  }, [user, selectedDept, timePeriod, customDateRange, API_URL, getDateRangeFromPeriod]);

  // Fetch click counts data
  const fetchClickCountsData = useCallback(async () => {
    if (!user?.is_admin || clickCountsLoading) return;
    
    try {
      setClickCountsLoading(true);
      const token = localStorage.getItem("token");
      
      let dateParams = {};
      if (customDateRange) {
        dateParams = customDateRange;
      } else {
        dateParams = getDateRangeFromPeriod(timePeriod);
      }
      
      const url = new URL(`${API_URL}/api/reports/click-counts`);
      url.searchParams.append('department', selectedDept || "all");
      url.searchParams.append('period', clickCountsPeriod);
      url.searchParams.append('startDate', dateParams.startDate);
      url.searchParams.append('endDate', dateParams.endDate);
      
      const response = await fetchWithRetry(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setClickCountsData(data.data.users || []);
          setClickCountsTrend(data.data.trend || []);
        }
      }
    } catch (err) {
      console.error("Error fetching click counts data:", err);
    } finally {
      setClickCountsLoading(false);
    }
  }, [API_URL, user, selectedDept, timePeriod, customDateRange, getDateRangeFromPeriod, clickCountsPeriod]);

  // Handle period change for click counts
  const handleClickCountsPeriodChange = (period) => {
    setClickCountsPeriod(period);
    setTimeout(() => {
      fetchClickCountsData();
    }, 100);
  };

  // Sort function for click counts table
  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  // Get sorted data
  const getSortedData = () => {
    const sortedData = [...clickCountsData];
    sortedData.sort((a, b) => {
      let aValue, bValue;
      
      switch(sortConfig.key) {
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'employee_id':
          aValue = a.employee_id || '';
          bValue = b.employee_id || '';
          break;
        case 'department':
          aValue = a.department || '';
          bValue = b.department || '';
          break;
        case 'total_clicks':
          aValue = a.click_count || 0;
          bValue = b.click_count || 0;
          break;
        case 'period_clicks':
          aValue = a.click_count_period || 0;
          bValue = b.click_count_period || 0;
          break;
        default:
          aValue = a.click_count || 0;
          bValue = b.click_count || 0;
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortedData;
  };

  // Fetch click counts data when tab changes
  useEffect(() => {
    if (activeTab === "clicks" && user?.is_admin && !clickCountsFetchedRef.current) {
      clickCountsFetchedRef.current = true;
      fetchClickCountsData();
    }
    
    return () => {
      if (activeTab !== "clicks") {
        clickCountsFetchedRef.current = false;
      }
    };
  }, [activeTab, fetchClickCountsData, user]);

  // Fetch data when period changes
  useEffect(() => {
    if (activeTab === "clicks" && user?.is_admin) {
      fetchClickCountsData();
    }
  }, [clickCountsPeriod, timePeriod, customDateRange, selectedDept, activeTab]);

  // Helper function to get ONLY the latest activity per candidate
const getLatestActivitiesPerCandidate = (activities) => {
  const candidateMap = {};
  
  activities.forEach(activity => {
    const key = activity.profile_id || activity.candidate_name;
    if (!key) return;
    
    if (!candidateMap[key]) {
      candidateMap[key] = {
        ...activity,
        total_calls: 1,
        total_duration: activity.duration || "00:00:00"
      };
    } else {
      // Always update to latest activity for status/note
      if (new Date(activity.created_at) > new Date(candidateMap[key].created_at)) {
        candidateMap[key] = {
          ...candidateMap[key],
          ...activity,
          total_calls: candidateMap[key].total_calls + 1,
          total_duration: (() => {
            const [h1, m1, s1] = (candidateMap[key].total_duration || "00:00:00").split(':').map(Number);
            const [h2, m2, s2] = (activity.duration || "00:00:00").split(':').map(Number);
            const totalSeconds = (h1 * 3600 + m1 * 60 + s1) + (h2 * 3600 + m2 * 60 + s2);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
          })()
        };
      } else {
        candidateMap[key].total_calls += 1;
        const [h1, m1, s1] = (candidateMap[key].total_duration || "00:00:00").split(':').map(Number);
        const [h2, m2, s2] = (activity.duration || "00:00:00").split(':').map(Number);
        const totalSeconds = (h1 * 3600 + m1 * 60 + s1) + (h2 * 3600 + m2 * 60 + s2);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        candidateMap[key].total_duration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }
  });
  
  // Sort by latest activity date
  return Object.values(candidateMap).sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );
};

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchReportData()
    }, 300000)
    
    return () => clearInterval(interval)
  }, [fetchReportData])

  useEffect(() => {
    if (!user) {
      navigate("/login")
      return
    }
    fetchReportData()
  }, [user, navigate, selectedDept, timePeriod, customDateRange, fetchReportData])

  // Fetch location stats
  const fetchLocationStats = useCallback(async () => {
    try {
      setLocationStatsLoading(true);
      const token = localStorage.getItem("token");
      
      let dateParams = {};
      if (customDateRange) {
        dateParams = customDateRange;
      } else {
        dateParams = getDateRangeFromPeriod(timePeriod);
      }
      
const url = new URL(`${API_URL}/api/reports/location-stats`);
url.searchParams.append('startDate', dateParams.startDate);
url.searchParams.append('endDate', dateParams.endDate);
url.searchParams.append('include_status_counts', 'true');

if (!user?.is_admin) {
  url.searchParams.append('user_id', user.id);
  url.searchParams.append('limit', '500'); // fetch all activities
}


if (user?.is_admin && selectedDept && selectedDept !== "all" && selectedDept !== "undefined") {
  url.searchParams.append('department', selectedDept);
}
      
      const response = await fetchWithRetry(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLocationData(data.data || []);
        }
      }
    } catch (err) {
      console.error("Error fetching location stats:", err);
    } finally {
      setLocationStatsLoading(false);
    }
  }, [API_URL, user, selectedDept, timePeriod, customDateRange, getDateRangeFromPeriod]);

  // Fetch location stats when tab changes
  useEffect(() => {
    if (activeTab === "location") {
      fetchLocationStats();
    }
  }, [activeTab, fetchLocationStats, timePeriod, customDateRange, selectedDept]);

  // Fetch email logs
  const fetchEmailLogs = useCallback(async () => {
    if (emailLogsLoading) return;
    
    try {
      setEmailLogsLoading(true);
      const token = localStorage.getItem("token");
      
      let dateParams = {};
      if (customDateRange) {
        dateParams = customDateRange;
      } else {
        dateParams = getDateRangeFromPeriod(timePeriod);
      }
      
      let deptParam = selectedDept;
      if (user?.is_admin) {
        if (selectedDept === "BD") deptParam = "Business Development";
        if (selectedDept === "Recruit") deptParam = "Recruitment";
        if (selectedDept === "Franchise") deptParam = "Franchise";
      } else {
        deptParam = user?.department;
      }
      
      const url = new URL(`${API_URL}/api/reports/email-logs`);
      url.searchParams.append('department', deptParam);
      url.searchParams.append('startDate', dateParams.startDate);
      url.searchParams.append('endDate', dateParams.endDate);
      
      if (!user?.is_admin) {
        url.searchParams.append('user_id', user.id);
      }
      
      const response = await fetchWithRetry(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setEmailLogs(data.data || []);
        }
      }
    } catch (err) {
      console.error("Error fetching email logs:", err);
    } finally {
      setEmailLogsLoading(false);
    }
  }, [API_URL, user, selectedDept, timePeriod, customDateRange, getDateRangeFromPeriod, emailLogsLoading]);

  // Fetch email logs when tab changes
  useEffect(() => {
    if (activeTab === "emaillogs" && !emailFetchedRef.current) {
      emailFetchedRef.current = true;
      fetchEmailLogs();
    }
    
    return () => {
      if (activeTab !== "emaillogs") {
        emailFetchedRef.current = false;
      }
    };
  }, [activeTab, fetchEmailLogs]);

  // Fetch login stats
  const fetchLoginStats = useCallback(async () => {
    if (!user?.is_admin) return;

    try {
      setLoginLoading(true);
      const token = localStorage.getItem("token");

      let dateParams = {};
      if (customDateRange) {
        dateParams = customDateRange;
      } else {
        dateParams = getDateRangeFromPeriod(loginPeriod);
      }

      const url = new URL(`${API_URL}/api/reports/login-stats`);
      url.searchParams.append('department', selectedDept || "all");
      url.searchParams.append('period', loginPeriod);
      url.searchParams.append('startDate', dateParams.startDate);
      url.searchParams.append('endDate', dateParams.endDate);

      const response = await fetchWithRetry(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLoginData(data.data);
        }
      }
    } catch (err) {
      console.error("Error fetching login stats:", err);
    } finally {
      setLoginLoading(false);
    }
  }, [API_URL, user, selectedDept, loginPeriod, customDateRange, getDateRangeFromPeriod]);

  // Fetch today's logins
  const fetchTodayLogins = useCallback(async () => {
    if (!user?.is_admin) return;

    try {
      setTodayLoginsLoading(true);
      const token = localStorage.getItem("token");

      const url = new URL(`${API_URL}/api/reports/login-today`);
      if (selectedDept && selectedDept !== "all") {
        url.searchParams.append('department', selectedDept);
      }

      const response = await fetchWithRetry(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTodayLogins(data.data || []);
        }
      }
    } catch (err) {
      console.error("Error fetching today's logins:", err);
    } finally {
      setTodayLoginsLoading(false);
    }
  }, [API_URL, user, selectedDept]);

  // Fetch login stats when tab changes
  useEffect(() => {
    if (activeTab === "logins" && user?.is_admin) {
      fetchLoginStats();
      fetchTodayLogins();
    }
  }, [activeTab, fetchLoginStats, fetchTodayLogins, loginPeriod, customDateRange, selectedDept]);

  const handleTimePeriodChange = (e) => {
    const newPeriod = e.target.value;
    setTimePeriod(newPeriod);
    if (newPeriod !== 'custom') {
      setCustomDateRange(null);
      setStartDate("");
      setEndDate("");
    }
    emailFetchedRef.current = false;
    clickCountsFetchedRef.current = false;
    setSearchQuery("");
  };

  const handleSyncData = async () => {
    try {
      setSyncing(true)
      await fetchReportData()
      if (activeTab === "emaillogs") {
        emailFetchedRef.current = false;
        await fetchEmailLogs()
      }
      if (activeTab === "location") {
        await fetchLocationStats();
      }
      if (activeTab === "clicks") {
        clickCountsFetchedRef.current = false;
        await fetchClickCountsData();
      }
      if (activeTab === "logins" && user?.is_admin) {
        await fetchLoginStats();
        await fetchTodayLogins();
      }
    } catch (err) {
      console.error("Error syncing data:", err)
    } finally {
      setSyncing(false)
    }
  }

  const handleCustomDateRange = () => {
    if (startDate && endDate) {
      setCustomDateRange({ startDate, endDate });
      emailFetchedRef.current = false;
      clickCountsFetchedRef.current = false;
    } else {
      alert("Please select both start and end dates");
    }
  };

  const handleResetTimePeriod = () => {
    setTimePeriod("all");
    setCustomDateRange(null);
    setStartDate("");
    setEndDate("");
    emailFetchedRef.current = false;
    clickCountsFetchedRef.current = false;
  };

  const fetchUserActivities = async (userId, showAll = false, search = "", status = "all") => {
    try {
      const token = localStorage.getItem("token");
      const limit = showAll ? 100 : 100;
      
      let dateParams = {};
      if (customDateRange) {
        dateParams = customDateRange;
      } else {
        dateParams = getDateRangeFromPeriod(timePeriod);
      }
      
      if (user?.is_admin) {
        let url = `${API_URL}/api/reports/user-candidates/${userId}?startDate=${dateParams.startDate}&endDate=${dateParams.endDate}`;
        
        if (search && search.trim() !== "") {
          url += `&search=${encodeURIComponent(search)}`;
        }
        
        if (status && status !== "all") {
          url += `&status=${status}`;
        }
        
        const response = await fetchWithRetry(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setUserActivities(data.data);
          } else {
            setUserActivities([]);
          }
        } else {
          setUserActivities([]);
        }
      } else {
        let url = `${API_URL}/api/reports/activities?userId=${userId}&limit=${limit}&startDate=${dateParams.startDate}&endDate=${dateParams.endDate}`;
        
        if (search && search.trim() !== "") {
          url += `&search=${encodeURIComponent(search)}`;
        }
        
        if (status && status !== "all") {
          url += `&status=${status}`;
        }
        
        const response = await fetchWithRetry(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setUserActivities(data.data);
          } else {
            setUserActivities([]);
          }
        } else {
          setUserActivities([]);
        }
      }
    } catch (err) {
      console.error("Error fetching user activities:", err);
      setUserActivities([]);
    }
  };

  const fetchActivityDetails = async (activityId, activityData = null) => {
    try {
      setContactLoading(true);
      const token = localStorage.getItem("token");
      
      const conflictCheckUrl = `${API_URL}/api/reports/candidate-conflict/${activityId}`;
      const conflictResponse = await fetchWithRetry(conflictCheckUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      let conflictData = null;
      if (conflictResponse.ok) {
        const conflictResult = await conflictResponse.json();
        if (conflictResult.success && conflictResult.data) {
          conflictData = conflictResult.data;
        }
      }

      const url = `${API_URL}/api/reports/activity/${activityId}`;
      const response = await fetchWithRetry(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const activity = data.data;
          
          const contactData = {
            id: activity.profile_id || activity.id,
            profile_id: activity.profile_id,
            name: activity.candidate_name || activity.profile_name || "Contact details unavailable",
            candidate_name: activity.candidate_name || activity.profile_name || "Contact details unavailable",
            company_name: activity.company_name || "—",
            current_location: activity.current_location || activity.candidate_location || "—",
            candidate_location: activity.current_location || activity.candidate_location || "—",
            phone: activity.phone ? String(activity.phone).replace('.0', '') : "",
            email: activity.email || "",
            status: activity.status || "in-progress",
            activity_status: activity.status || "in-progress",
            note: activity.note || "",
            activity_note: activity.note || "",
            duration: activity.duration || "00:00:00",
            activity_duration: activity.duration || "00:00:00",
            created_at: activity.created_at || new Date().toISOString(),
            activity_date: formatDateIST(activity.created_at) || formatDateIST(new Date().toISOString()),
            department: activity.department || activity.user_department || user?.department || "—",
            designation: activity.designation || "—",
            total_experience: activity.total_experience ? activity.total_experience + " Yrs" : "—",
            education: activity.last_education || activity.qualification || "—",
            last_education: activity.last_education || "—",
            qualification: activity.qualification || "—",
            notice_period: activity.notice_period || "—",
            key_skills: activity.key_skills || "—",
            annual_salary: activity.annual_salary ? activity.annual_salary.toString() : "—",
            previous_employer: activity.previous_employer || "—",
            user_name: activity.user_name || user?.name || "—",
            employee_id: activity.employee_id || user?.employee_id || "—",
            candidate_conflict: conflictData,
          };
          
          console.log("Formatted contact data:", contactData);
          setSelectedContact(contactData);
          setCandidateConflict(conflictData);
          setShowContactPopup(true);
          return contactData;
        }
      }
      
      console.warn("Using fallback contact data for activity:", activityId);
      const fallbackName = 
        activityData?.profile_name || 
        activityData?.candidate_name || 
        activityData?.name || 
        (activityData?.company_name ? `Contact from ${activityData.company_name}` : "Contact");
      
      const minimalContact = {
        id: activityId,
        profile_id: activityData?.profile_id,
        name: fallbackName,
        candidate_name: fallbackName,
        company_name: activityData?.company_name || "—",
        current_location: activityData?.candidate_location || "—",
        candidate_location: activityData?.candidate_location || "—",
        phone: activityData?.phone ? String(activityData.phone).replace('.0', '') : "",
        email: activityData?.email || "",
        status: activityData?.status || "in-progress",
        activity_status: activityData?.status || "in-progress",
        note: activityData?.note || "",
        activity_note: activityData?.note || "",
        duration: activityData?.duration || "00:00:00",
        activity_duration: activityData?.duration || "00:00:00",
        created_at: activityData?.created_at || new Date().toISOString(),
        activity_date: formatDateIST(activityData?.created_at) || formatDateIST(new Date().toISOString()),
        department: activityData?.department || user?.department || "—",
        designation: activityData?.designation || "—",
        total_experience: activityData?.total_experience || "—",
        education: "—",
        last_education: "—",
        qualification: "—",
        notice_period: "—",
        key_skills: "—",
        annual_salary: "—",
        previous_employer: "—",
        user_name: activityData?.user_name || user?.name || "—",
        employee_id: activityData?.employee_id || user?.employee_id || "—",
        candidate_conflict: conflictData,
      };
      
      setSelectedContact(minimalContact);
      setCandidateConflict(conflictData);
      setShowContactPopup(true);
      return minimalContact;
      
    } catch (err) {
      console.error("Error fetching activity details:", err);
      const contactName = 
        activityData?.profile_name || 
        activityData?.candidate_name || 
        activityData?.name || 
        (activityData?.company_name ? `Contact from ${activityData.company_name}` : "Contact");
      
      const fallbackContact = {
        id: activityId,
        profile_id: activityData?.profile_id,
        name: contactName,
        candidate_name: contactName,
        company_name: activityData?.company_name || "—",
        current_location: activityData?.candidate_location || "—",
        candidate_location: activityData?.candidate_location || "—",
        phone: activityData?.phone ? String(activityData.phone).replace('.0', '') : "",
        email: activityData?.email || "",
        status: activityData?.status || "in-progress",
        note: activityData?.note || "",
        duration: activityData?.duration || "00:00:00",
        created_at: activityData?.created_at || new Date().toISOString(),
        activity_date: formatDateIST(activityData?.created_at) || formatDateIST(new Date().toISOString()),
        user_name: activityData?.user_name || user?.name || "—",
        employee_id: activityData?.employee_id || user?.employee_id || "—",
      };
      setSelectedContact(fallbackContact);
      setCandidateConflict(null);
      setShowContactPopup(true);
      return fallbackContact;
    } finally {
      setContactLoading(false);
    }
  };

  const handleViewContact = async (activity) => {
    try {
      setContactLoading(true);
      await fetchActivityDetails(activity.id || activity.profile_id, activity);
    } catch (err) {
      console.error("Error handling contact view:", err);
    } finally {
      setContactLoading(false);
    }
  };

  const handleViewUserLogs = async (userItem) => {
    setSelectedUser(userItem);
    setUserLogsSearch("");
    setUserLogsStatus("all");
    await fetchUserActivities(userItem.id, false, "", "all");
    setShowUserLogs(true);
  };

  const handleViewCandidateLogs = async (activity) => {
    try {
      const token = localStorage.getItem("token");
      const url = `${API_URL}/api/reports/activities?userId=${activity.user_id}&period=${timePeriod || 'all'}&startDate=${customDateRange?.start || ''}&endDate=${customDateRange?.end || ''}`;
      
      const response = await fetchWithRetry(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && Array.isArray(data.data || [])) {
          const candidateActivities = (data.data || []).filter(
            act => act.profile_id === activity.profile_id
          );
          
          const candidateLogsData = {
            candidate_name: activity.candidate_name || activity.profile_name || "Unknown",
            user_name: activity.user_name || selectedUser?.name || "—",
            employee_id: activity.employee_id || selectedUser?.employee_id || "—",
            department: activity.user_department || activity.department || selectedUser?.department || "—",
            profile_id: activity.profile_id,
            total_calls: candidateActivities.length,
            call_logs: candidateActivities.map(log => ({
              id: log.id,
              created_at: log.created_at,
              created_at_ist: log.created_at_ist,
              duration: log.duration || "00:00:00",
              status: log.status,
              note: log.note || log.notes || "",
              notes: log.notes || log.note || "",
              candidate_location: log.candidate_location || log.current_location || "—"
            }))
          };
          
          console.log("Candidate logs data:", candidateLogsData);
          setSelectedCandidateLogs(candidateLogsData);
          setShowCandidateLogs(true);
          return;
        }
      }
      
      const candidateLogsData = {
        candidate_name: activity.candidate_name || activity.profile_name || "Unknown",
        user_name: activity.user_name || selectedUser?.name || "—",
        employee_id: activity.employee_id || selectedUser?.employee_id || "—",
        department: activity.user_department || activity.department || selectedUser?.department || "—",
        profile_id: activity.profile_id,
        total_calls: 1,
        call_logs: [{
          id: activity.id,
          created_at: activity.created_at,
          duration: activity.duration || "00:00:00",
          status: activity.status,
          note: activity.note || activity.notes || "",
          candidate_location: activity.candidate_location || "—"
        }]
      };
      
      setSelectedCandidateLogs(candidateLogsData);
      setShowCandidateLogs(true);
      
    } catch (error) {
      console.error("Error fetching candidate call logs:", error);
      const candidateLogsData = {
        candidate_name: activity.candidate_name || activity.profile_name || "Unknown",
        user_name: activity.user_name || selectedUser?.name || "—",
        employee_id: activity.employee_id || selectedUser?.employee_id || "—",
        department: activity.user_department || activity.department || selectedUser?.department || "—",
        profile_id: activity.profile_id,
        total_calls: 1,
        call_logs: [{
          id: activity.id,
          created_at: activity.created_at,
          duration: activity.duration || "00:00:00",
          status: activity.status,
          note: activity.note || activity.notes || "",
          candidate_location: activity.candidate_location || "—"
        }]
      };
      
      setSelectedCandidateLogs(candidateLogsData);
      setShowCandidateLogs(true);
    }
  };

  const handleExportUserActivity = async (userId, userName) => {
    try {
      setExporting(true);
      
      let dateParams = {};
      if (customDateRange) {
        dateParams = customDateRange;
      } else {
        dateParams = getDateRangeFromPeriod(timePeriod);
      }
      
      let url = `${API_URL}/api/reports/export-user-activity/${userId}?startDate=${dateParams.startDate}&endDate=${dateParams.endDate}`;
      
      if (userLogsStatus && userLogsStatus !== "all") {
        url += `&status=${userLogsStatus}`;
      }
      
      if (userLogsSearch && userLogsSearch.trim() !== "") {
        url += `&search=${encodeURIComponent(userLogsSearch)}`;
      }
      
      const token = localStorage.getItem("token");
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to export data");
      }

      const data = await response.json();
      
      if (data.success && data.data.length > 0) {
        const headers = Object.keys(data.data[0]).join(",");
        const rows = data.data.map((row) =>
          Object.values(row)
            .map((value) => `"${(value || "").toString().replace(/"/g, '""')}"`)
            .join(",")
        );
        const csv = [headers, ...rows].join("\n");
        
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const objectUrl = URL.createObjectURL(blob);
        link.setAttribute("href", objectUrl);
        link.setAttribute("download", `activity_report_${userName}_${Date.now()}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
        
        alert(`Exported ${data.data.length} activities successfully!`);
      } else {
        alert("No data to export for the selected filters.");
      }
    } catch (err) {
      console.error("Error exporting user activity:", err);
      alert("Failed to export data: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportUpdatedCandidates = async () => {
    if (!updatedCandidatesData.length) {
      alert("No data to export");
      return;
    }

    try {
      const headers = Object.keys(updatedCandidatesData[0]).join(",");
      const rows = updatedCandidatesData.map((row) =>
        Object.values(row)
          .map((value) => `"${(value || "").toString().replace(/"/g, '""')}"`)
          .join(",")
      );
      const csv = [headers, ...rows].join("\n");
      
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      link.setAttribute("href", objectUrl);
      link.setAttribute("download", `updated_candidates_${Date.now()}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      
      alert(`Exported ${updatedCandidatesData.length} records successfully!`);
    } catch (err) {
      console.error("Error exporting updated candidates:", err);
      alert("Failed to export data");
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === "00:00:00") return "0h 0m"
    const [hours, minutes, seconds] = timeStr.split(":").map(Number)
    const totalMinutes = minutes + seconds / 60
    return `${hours}h ${Math.round(totalMinutes)}m`
  }

  const getStatusColor = (status) => {
    const colors = {
      "in-progress": "bg-yellow-100 text-yellow-800 border-yellow-200",
      cancelled: "bg-red-100 text-red-800 border-red-200",
      closed: "bg-green-100 text-green-800 border-green-200",
      "follow-up": "bg-blue-100 text-blue-800 border-blue-200",
      updated: "bg-purple-100 text-purple-800 border-purple-200",
      pending: "bg-gray-100 text-gray-800 border-gray-200",
    }
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-200"
  }

  const getDepartmentColor = (dept) => {
    const colors = {
      BD: "bg-purple-100 text-purple-800 border-purple-200",
      Recruit: "bg-blue-100 text-blue-800 border-blue-200",
      Franchise: "bg-green-100 text-green-800 border-green-200",
      Admin: "bg-red-100 text-red-800 border-red-200",
      "Business Development": "bg-purple-100 text-purple-800 border-purple-200",
      "Recruitment (Franchise)": "bg-blue-100 text-blue-800 border-blue-200",
      "Franchise Developer": "bg-green-100 text-green-800 border-green-200",
    }
    return colors[dept] || "bg-gray-100 text-gray-800 border-gray-200"
  }

  const getLocationColor = (location) => {
    const colors = {
      Mumbai: "bg-blue-50 border-blue-200",
      Pune: "bg-green-50 border-green-200",
      Hyderabad: "bg-yellow-50 border-yellow-200",
      Ahmedabad: "bg-red-50 border-red-200",
      Chennai: "bg-purple-50 border-purple-200",
      Bangalore: "bg-indigo-50 border-indigo-200",
      Kolkata: "bg-pink-50 border-pink-200",
      Delhi: "bg-teal-50 border-teal-200",
    }
    return colors[location] || "bg-gray-50 border-gray-200"
  }

const handleSearchChange = (e) => {
  const value = e.target.value
  const pos = e.target.selectionStart

  // Update query immediately so input stays responsive
  setSearchQuery(value)

  // Restore focus+cursor immediately (before the filter re-render)
  requestAnimationFrame(() => {
    if (adminSearchInputRef.current) {
      adminSearchInputRef.current.focus()
      adminSearchInputRef.current.setSelectionRange(pos, pos)
    }
  })

  if (searchTimeoutRef.current) {
    clearTimeout(searchTimeoutRef.current)
  }

  searchTimeoutRef.current = setTimeout(() => {
    if (reportData) {
      if (activeTab === "overview" && user?.is_admin) {
        const filtered = (reportData.userPerformance || []).filter(
          (userItem) =>
            value === "" ||
            userItem.name?.toLowerCase().includes(value.toLowerCase()) ||
            userItem.employee_id?.toLowerCase().includes(value.toLowerCase()) ||
            userItem.email?.toLowerCase().includes(value.toLowerCase())
        )
        setFilteredUsers(filtered)
      } else if (activeTab === "overview" && !user?.is_admin) {
        const latestActivities = getLatestActivitiesPerCandidate(reportData.recentActivities || []);
        const filtered = latestActivities.filter(
          (activity) =>
            value === "" ||
            (activity.profile_name && activity.profile_name.toLowerCase().includes(value.toLowerCase())) ||
            (activity.candidate_name && activity.candidate_name.toLowerCase().includes(value.toLowerCase())) ||
            (activity.note && activity.note.toLowerCase().includes(value.toLowerCase())) ||
            (activity.candidate_location && activity.candidate_location.toLowerCase().includes(value.toLowerCase())) ||
            (activity.company_name && activity.company_name.toLowerCase().includes(value.toLowerCase())) ||
            (activity.status && activity.status.toLowerCase().includes(value.toLowerCase()))
        )
        setFilteredActivities(filtered)
      }
    }
    // Re-restore after filter re-render
    requestAnimationFrame(() => {
      if (adminSearchInputRef.current) {
        adminSearchInputRef.current.focus()
        adminSearchInputRef.current.setSelectionRange(pos, pos)
      }
    })
  }, 300)
}

  const calculateAvgCallTime = (totalCallHours, totalActivities) => {
    if (!totalCallHours || !totalActivities || totalActivities === 0) return "0h 0m"

    try {
      const [hours, minutes] = totalCallHours.split(":").map(Number)
      const totalMinutes = hours * 60 + minutes
      const avgMinutes = totalMinutes / totalActivities
      const avgHours = Math.floor(avgMinutes / 60)
      const avgMins = Math.round(avgMinutes % 60)
      return `${avgHours}h ${avgMins}m`
    } catch (error) {
      return "0h 0m"
    }
  }

  const handleResetFilters = () => {
    setSelectedDept(user?.is_admin ? "all" : user?.department)
    setSearchQuery("")
  }

  const getPeriodDisplayName = () => {
    if (customDateRange) {
      return `${formatDateOnlyIST(customDateRange.startDate)} to ${formatDateOnlyIST(customDateRange.endDate)}`;
    }
    switch(timePeriod) {
      case '60days': return 'Last 60 Days';
      case '90days': return 'Last 90 Days';
      case '365days': return 'Last 365 Days';
      case 'all': return 'All Time';
      case '7days': return 'Last 7 Days';
      default: return 'Last 7 Days';
    }
  };

  // Get unique users for updated candidates filter
  const getUniqueUsersForFilter = () => {
    const usersMap = new Map();
    updatedCandidatesData.forEach(item => {
      if (item.user_id && item.user_name && !usersMap.has(item.user_id)) {
        usersMap.set(item.user_id, { id: item.user_id, name: item.user_name });
      }
    });
    return Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (reportData) {
      if (!user?.is_admin) {
        const latestActivities = getLatestActivitiesPerCandidate(reportData.recentActivities || []);
        setFilteredActivities(latestActivities);
      } else {
        setFilteredUsers(reportData.userPerformance || []);
        setFilteredActivities(reportData.recentActivities || []);
      }
    }
  }, [reportData, user]);

  // Handle location click
  const handleLocationClick = async (locationName) => {
    try {
      setLocationDetailsLoading(true);
      const token = localStorage.getItem("token");
      
      let dateParams = {};
      if (customDateRange) {
        dateParams = customDateRange;
      } else {
        dateParams = getDateRangeFromPeriod(timePeriod);
      }
      
      const url = new URL(`${API_URL}/api/reports/location-details`);
      url.searchParams.append('location', locationName);
      url.searchParams.append('startDate', dateParams.startDate);
      url.searchParams.append('endDate', dateParams.endDate);
      
      if (!user?.is_admin) {
        url.searchParams.append('user_id', user.id);
      }
      
      if (user?.is_admin && selectedDept && selectedDept !== "all") {
        url.searchParams.append('department', selectedDept);
      }
      
      console.log('Fetching location details:', url.toString());
      
      const response = await fetchWithRetry(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setLocationDetailsData(data.data || []);
        setSelectedLocation(locationName);
        setShowLocationDetails(true);
      } else {
        throw new Error(data.message || "Failed to load location details");
      }
    } catch (err) {
      console.error("Error fetching location details:", err);
      alert(`Failed to load location details: ${err.message}`);
    } finally {
      setLocationDetailsLoading(false);
    }
  };

  // Updated Candidates Report Popup Component
  const UpdatedCandidatesPopup = () => {
    if (!showUpdatedCandidates) return null;

    const filteredData = updatedCandidatesData.filter(item => {
      if (updatedCandidatesSearch && !item.candidate_name?.toLowerCase().includes(updatedCandidatesSearch.toLowerCase()) &&
          !item.user_name?.toLowerCase().includes(updatedCandidatesSearch.toLowerCase())) {
        return false;
      }
      return true;
    });

    // Get unique users for filter
    const getUniqueUsersForFilter = () => {
      const usersMap = new Map();
      updatedCandidatesData.forEach(item => {
        if (item.user_id && item.user_name && !usersMap.has(item.user_id)) {
          usersMap.set(item.user_id, { id: item.user_id, name: item.user_name });
        }
      });
      return Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    };

  // Handle user filter change - triggers API refetch
  const handleUserFilterChange = (userId) => {
      setUpdatedCandidatesUserFilter(userId);
      // Immediate fetch to reflect change, with a small safeguard debounce in case of rapid changes
      fetchUpdatedCandidates(userId);
  };

    // Handle search with debounce to prevent re-render issues
    const handleSearchChange = (e) => {
      const value = e.target.value;
      setUpdatedCandidatesSearch(value);
      // Keep the input focused
      e.target.focus();
    };

    const handleExport = () => {
      handleExportUpdatedCandidates();
    };

    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-indigo-50 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-purple-800">Updated Candidates Report</h2>
              <p className="text-gray-600">
                Showing candidates with status "Updated" for period: {getPeriodDisplayName()}
              </p>
            </div>
            <button onClick={() => setShowUpdatedCandidates(false)} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-4 border-b bg-white">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  ref={updatedCandidatesSearchRef}
                  type="text"
                  placeholder="Search by candidate or user name..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  value={updatedCandidatesSearch}
                  onChange={(e) => {
                    const val = e.target.value
                    const pos = e.target.selectionStart
                    setUpdatedCandidatesSearch(val)
                    // Keep the cursor position after state update
                    requestAnimationFrame(() => {
                      try {
                        if (updatedCandidatesSearchRef.current) {
                          updatedCandidatesSearchRef.current.setSelectionRange(pos, pos)
                        }
                      } catch {}
                    })
                  }}
                />
              </div>
              <div className="flex gap-2">
                {/* <select
                  value={updatedCandidatesUserFilter}
                  onChange={(e) => handleUserFilterChange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Users</option>
                  {getUniqueUsersForFilter().map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select> */}
                <button
                  onClick={() => {
                    setUpdatedCandidatesSearch("");
                    setUpdatedCandidatesUserFilter("all");
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Reset
                </button>
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export to Excel
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {updatedCandidatesLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading updated candidates...</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">No Updated Candidates Found</h3>
                <p className="text-gray-500">
                  No candidates with status "Updated" were found in the selected period.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">User</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Department</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Candidate Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Company</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Location</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Phone</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Updated Date (IST)</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium text-black">{item.user_name}</div>
                          <div className="text-xs text-gray-500">{item.employee_id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDepartmentColor(item.department)}`}>
                            {item.department}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">{item.candidate_name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{item.company_name || "—"}</td>
                        <td className="py-3 px-4">
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            {item.candidate_location || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">{item.user_phone || item.phone || "—"}</td>
                        <td className="py-3 px-4 text-sm truncate max-w-xs">{item.user_email || item.email || "—"}</td>
                        <td className="py-3 px-4 text-sm">{formatDateIST(item.updated_at)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700 max-w-xs">
                          <div className="truncate group relative">
                            {item.note || "-"}
                            {item.note && item.note.length > 50 && (
                              <div className="absolute hidden group-hover:block z-50 bg-white p-2 border rounded shadow-lg max-w-md mt-1 text-xs">
                                {item.note}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 text-sm text-gray-600">
                  Showing {filteredData.length} updated candidates
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Click on "Export to Excel" to download this report
            </div>
            <button
              onClick={() => setShowUpdatedCandidates(false)}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report data...</p>
        </div>
      </div>
    )
  }

  if (error || !reportData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Reports</h2>
          <p className="text-gray-600 mb-6">{error || "No data available"}</p>
          <button
            onClick={fetchReportData}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const {
    overallStats,
    userPerformance,
    recentActivities,
    departmentStatusData,
    isAdmin,
  } = reportData

  // Admin Overview Component with Updated KPI
// Admin Status Charts (legacy alias)
const AdminStatusCharts = () => {
  const data = reportData?.data?.departmentStatusData || [];
  // derive unique users from data
  const userMap = new Map();
  data.forEach(d => {
    if (d.user_id != null && d.user_name) {
      if (!userMap.has(d.user_id)) userMap.set(d.user_id, { id: d.user_id, name: d.user_name, employee_id: d.employee_id });
    }
  });
  const users = Array.from(userMap.values()).sort((a,b) => a.name.localeCompare(b.name));
  const [selectedUser, setSelectedUser] = useState("all");
  const filtered = selectedUser === "all" ? data : data.filter(x => String(x.user_id) === String(selectedUser));
  const statuses = ["in-progress","cancelled","closed","follow-up","updated","pending"];
  const depts = ["BD","Recruit","Franchise"];
  // build per-dept counts
  const countsByDept = depts.reduce((acc, dep) => { acc[dep] = statuses.reduce((m, s) => { m[s] = 0; return m; }, {}); return acc; }, {});
  filtered.forEach(it => {
    if (it.department && countsByDept[it.department]) {
      if (it.status && countsByDept[it.department][it.status] != null) {
        countsByDept[it.department][it.status] += (it.count || 0);
      }
    }
  });
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-semibold text-black">Status by User</div>
        <div className="flex items-center gap-2">
          {/* <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
            <option value="all">All Users</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.employee_id})</option>
            ))}
          </select> */}
        </div>
        {/* Per-admin status charts (all users) */}
        // AdminStatusCharts removed to resolve duplication
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {depts.map(dep => (
          <div key={dep} className="p-3 border rounded bg-gray-50">
            <div className="text-sm font-semibold text-gray-700 mb-2">{dep === 'BD' ? 'Business Development' : dep === 'Recruit' ? 'Recruitment' : 'Franchise Development'}</div>
            <div className="h-40 flex items-end">
              {statuses.map((st) => {
                const c = countsByDept[dep]?.[st] || 0
                const max = Math.max(1, statuses.reduce((acc, s) => Math.max(acc, countsByDept[dep]?.[s] || 0), 0));
                const height = max > 0 ? (c / max) * 100 : 0
                return (
                  <div key={st} className="flex-1 mx-1" style={{ display:'flex', flexDirection:'column', alignItems:'center' }} title={`${st}: ${c}`}>
                    <div style={{ width: 18, height: Math.max(6, height), background: '#6366f1', borderRadius: 4 }}></div>
                    <div className="text-xs text-gray-700 mt-1" style={{ whiteSpace:'nowrap' }}>{st}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
};

const AdminOverview = () => {
    const deptData = {
      totalUsers: overallStats?.total_users || 0,
      totalCalls: overallStats?.total_activities || 0,
      totalClosures: overallStats?.closed_deals || 0,
      totalCallHours: overallStats?.total_call_hours || "00:00:00",
      totalClickCounts: (userPerformance || []).reduce((sum, user) => sum + (user.click_count || 0), 0),
      totalUpdated: overallStats?.total_updated || 0
    };
    
    const avgCallTime = calculateAvgCallTime(deptData.totalCallHours, deptData.totalCalls);

    const getDepartmentDisplayName = () => {
      switch (selectedDept) {
        case "BD": return "Business Development";
        case "Recruit": return "Recruitment";
        case "Franchise": return "Franchise Development";
        case "all": return "All Departments";
        default: return selectedDept;
      }
    };

    const getFilteredTopPerformers = () => {
      let performers = [];
      
      if (selectedDept === "all") {
        performers = [...(userPerformance || [])];
      } else {
        performers = (userPerformance || []).filter(user => {
          const userDept = user.department?.toString().trim().toLowerCase();
          const selectedDeptLower = selectedDept?.toString().trim().toLowerCase();
          
          const deptMap = {
            'bd': ['bd', 'business development', 'business-development'],
            'recruit': ['recruit', 'recruitment'],
            'franchise': ['franchise', 'franchise development']
          };
          
          if (selectedDeptLower === 'bd') {
            return deptMap.bd.includes(userDept);
          } else if (selectedDeptLower === 'recruit') {
            return deptMap.recruit.includes(userDept);
          } else if (selectedDeptLower === 'franchise') {
            return deptMap.franchise.includes(userDept);
          }
          
          return userDept === selectedDeptLower;
        });
      }
      
      return performers
        .sort((a, b) => {
          const viewsA = a.unique_profile_views || a.click_count || 0;
          const viewsB = b.unique_profile_views || b.click_count || 0;
          
          if (viewsB !== viewsA) {
            return viewsB - viewsA;
          }
          
          const callsA = a.activity_count || 0;
          const callsB = b.activity_count || 0;
          
          if (callsB !== callsA) {
            return callsB - callsA;
          }
          
          const closedA = a.closed_count || 0;
          const closedB = b.closed_count || 0;
          return closedB - closedA;
        })
        .slice(0, 5);
    };
    
    const topPerformers = getFilteredTopPerformers();

    // Handle Updated KPI click
    const handleUpdatedKpiClick = async () => {
      await fetchUpdatedCandidates();
      setShowUpdatedCandidates(true);
    };

    return (
      <div className="space-y-6">
        {lastUpdate && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-gray-500">
              Last updated: {formatDateIST(lastUpdate.toISOString())}
            </span>
            <span className="text-xs text-gray-500">
              | Department: {getDepartmentDisplayName()}
            </span>
            <span className="text-xs text-gray-500">
              | Period: {getPeriodDisplayName()}
            </span>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <h3 className="text-3xl font-bold text-black mt-2">
                  {deptData.totalUsers}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  All users in {getDepartmentDisplayName().toLowerCase()}
                </p>
              </div>
              <Users className="w-10 h-10 text-gray-700" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Calls</p>
                <h3 className="text-3xl font-bold text-black mt-2">
                  {deptData.totalCalls}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Calls in selected period
                </p>
              </div>
              <Target className="w-10 h-10 text-gray-700" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Closures</p>
                <h3 className="text-3xl font-bold text-black mt-2">
                  {deptData.totalClosures}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Successful deals closed
                </p>
              </div>
              <BarChart3 className="w-10 h-10 text-gray-700" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Click Counts</p>
                <h3 className="text-3xl font-bold text-black mt-2">
                  {deptData.totalClickCounts.toLocaleString()}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Total profile views
                </p>
              </div>
              <Eye className="w-10 h-10 text-gray-700" />
            </div>
          </div>

          {/* Updated KPI - Clickable */}
          <div 
            className="bg-white p-6 rounded-2xl border border-purple-200 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={handleUpdatedKpiClick}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 group-hover:text-purple-700">Updated Candidates</p>
                <h3 className="text-3xl font-bold text-purple-600 mt-2">
                  {
                    (() => {
                      const dist = reportData?.data?.statusDistribution ?? reportData?.departmentStatusData ?? []
                      const totalUpdated = dist.filter(d => d.status === 'updated').reduce((acc, cur) => acc + (cur.count || 0), 0)
                      if (totalUpdated > 0) return totalUpdated
                      // Fallback to actual updated-candidates data length if available
                      return Array.isArray(updatedCandidatesData) ? updatedCandidatesData.length : 0
                    })()
                  }
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Candidates with status "Updated"
                </p>
                <p className="text-xs text-purple-500 mt-2 opacity-0 group-hover:opacity-100 transition">
                  Click to view details →
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-purple-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="text-xl font-bold text-black flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Top Performers
              <span className="text-sm font-normal text-gray-600">
                ({getDepartmentDisplayName()})
              </span>
            </h3>
            <div className="text-sm text-gray-500">
              Showing top 5 performers based on profile views, calls & closures
            </div>
          </div>
          
          {topPerformers.length > 0 ? (
            <div className="space-y-4">
              {topPerformers.map((userItem, index) => (
                <div
                  key={userItem.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedUserForViews({ id: userItem.id, name: userItem.name });
                    setShowViewedProfiles(true);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                      ${index < 3 ? "bg-yellow-100 text-yellow-800 border border-yellow-200" : "bg-gray-100 text-gray-800 border border-gray-200"}`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-black">{userItem.name}</p>
                      <p className="text-sm text-gray-500">
                        {userItem.employee_id} • {userItem.department}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm text-gray-600">Calls:</span>
                        <span className="font-semibold text-black">
                          {userItem.activity_count || userItem.call_count || userItem.total_calls || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm text-gray-600">Closed:</span>
                        <span className="font-semibold text-green-600">{userItem.closed_count || 0}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">Views:</span>
                        <span className="font-semibold text-blue-600">{userItem.click_count || 0}</span>
                      </div>
                    </div>
                    <div className="text-right border-l pl-4">
                      <p className="font-semibold text-black">{formatTime(userItem.total_hours)}</p>
                    </div>
                  </div>
                </div>
              ))}
              
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Users className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500">No users found in {getDepartmentDisplayName().toLowerCase()}</p>
              <p className="text-sm text-gray-400 mt-2">
                This department has no active users or no performance data yet
              </p>
            </div>
          )}
        </div>

        {/* Performance Details Table */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="text-xl font-bold text-black">Performance Details ({getDepartmentDisplayName()})</h3>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
              <div className="relative">
  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
  <input
    ref={adminSearchInputRef}
    type="text"
    placeholder="Search by name, ID or email..."
    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-64"
    value={searchQuery}
   onChange={handleSearchChange}
  />
</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">User ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Department</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">User Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Total Call Hours</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Profile Views</th>
                  
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                 </tr>
              </thead>
              <tbody>
                {filteredUsers.map((userItem) => (
                  <tr key={userItem.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono font-medium text-black">{userItem.employee_id}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getDepartmentColor(userItem.department)}`}
                      >
                        {userItem.department}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-700" />
                        </div>
                        <div>
                          <p className="font-medium text-black">{userItem.name}</p>
                          <p className="text-sm text-gray-500">{userItem.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-black">{formatTime(userItem.total_hours)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {userItem.activity_count || userItem.call_count || userItem.total_calls || 0} calls
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div 
                        className="flex items-center cursor-pointer group relative"
                        onDoubleClick={() => {
                          setSelectedUserForViews({ id: userItem.id, name: userItem.name });
                          setShowViewedProfiles(true);
                        }}
                        title={`Unique profiles viewed: ${userItem.unique_profile_views || userItem.click_count || 0}`}
                      >
                        <div className="flex items-center hover:text-indigo-800 transition-colors">
                          <Eye className="w-4 h-4 text-indigo-600 mr-2" />
                          <span className="font-semibold text-indigo-700">
                            {userItem.click_count || 0}
                          </span>
                        </div>
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                          Unique profiles: {userItem.click_count || 0} | Double-click to view
                        </div>
                      </div>
                    </td>
                    
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleViewUserLogs(userItem)}
                        className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View Activity
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-gray-500">
                      No users found matching your search criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // Department Overview Component (non-admin)
  const DepartmentOverview = () => {
    if (activeTab !== "overview") return null

    const userActivities = (recentActivities || []).filter(activity => 
      activity.user_id === user?.id || 
      activity.user_name === user?.name
    );

const getLatestPerCandidate = () => {
  // Use filteredActivities from state which already has latest per candidate
  return filteredActivities;
};

const latestActivities = getLatestPerCandidate();

    const getPersonalDailyStats = () => {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const today = new Date();
      
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (6 - i));
        return date;
      });

      const personalActivitiesByDay = {};
      
      last7Days.forEach(date => {
        const dateStr = date.toISOString().split('T')[0];
        personalActivitiesByDay[dateStr] = [];
      });

      userActivities.forEach(activity => {
        try {
          const activityDate = new Date(activity.created_at);
          if (isNaN(activityDate.getTime())) return;
          
          const dateStr = activityDate.toISOString().split('T')[0];
          if (personalActivitiesByDay[dateStr]) {
            personalActivitiesByDay[dateStr].push(activity);
          }
        } catch (error) {
          console.error("Error parsing activity date:", error);
        }
      });

      const dailyStats = last7Days.map((date, index) => {
        const dayName = days[date.getDay()];
        const dateStr = date.toISOString().split('T')[0];
        const personalCalls = personalActivitiesByDay[dateStr]?.length || 0;
        
        const dayActivities = personalActivitiesByDay[dateStr] || [];
        let totalSeconds = 0;
        dayActivities.forEach(activity => {
          if (activity.duration) {
            const [hours, minutes, seconds] = activity.duration.split(':').map(Number);
            totalSeconds += (hours * 3600) + (minutes * 60) + seconds;
          }
        });
        const totalHours = (totalSeconds / 3600).toFixed(1);

        return {
          day: dayName,
          calls: personalCalls,
          hours: totalHours,
          date: dateStr
        };
      });

      return dailyStats;
    };
    
    const personalDailyStats = getPersonalDailyStats();
    const maxCalls = Math.max(...personalDailyStats.map(d => d.calls), 1);
    const scaleFactor = 180 / maxCalls;

    return (
      <div className="space-y-6">
        {lastUpdate && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-gray-500">
              Last updated: {formatDateIST(lastUpdate.toISOString())}
            </span>
            <span className="text-xs text-gray-500">
              | Period: {getPeriodDisplayName()}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">My Closed Calls</p>
                <h3 className="text-3xl font-bold text-black mt-2">
                  {latestActivities.filter(a => a.status === 'closed').length || 0}
                </h3>
              </div>
              <Target className="w-10 h-10 text-gray-700" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">My Total Call Hours</p>
                <h3 className="text-3xl font-bold text-black mt-2">
                  {formatTime(overallStats?.total_call_hours) || "0h 0m"}
                </h3>
              </div>
              <Clock className="w-10 h-10 text-gray-700" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">My Total Candidates</p>
                <h3 className="text-3xl font-bold text-black mt-2">
                  {latestActivities.length || 0}
                </h3>
              </div>
              <Users className="w-10 h-10 text-gray-700" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-black mb-6">My Daily Activity (Last 7 Days)</h3>
          
          <div className="flex flex-col space-y-6">
            <div className="flex items-end justify-between h-64 px-4 py-6 border-b border-gray-200">
              {personalDailyStats.map((dayData, index) => (
                <div key={dayData.date} className="flex flex-col items-center flex-1 mx-1 relative group">
                  <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white rounded px-3 py-2 text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 shadow-lg">
                    <div className="font-semibold">{dayData.day} ({dayData.date})</div>
                    <div className="mt-1">Calls: {dayData.calls}</div>
                    <div className="mt-1">Hours: {dayData.hours}h</div>
                  </div>

                  <div className="relative w-full flex justify-center">
                    <div
                      className="w-8 bg-indigo-600 rounded-t-lg hover:opacity-90 transition-all duration-300 cursor-pointer"
                      style={{
                        height: `${Math.max(dayData.calls * scaleFactor, 4)}px`,
                      }}
                    ></div>
                    {dayData.calls > 0 && (
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-indigo-600">
                        {dayData.calls}
                      </div>
                    )}
                  </div>
                  
                  <span className="text-sm font-medium text-gray-700 mt-3">{dayData.day}</span>
                  <span className="text-xs text-gray-500 mt-1">{dayData.hours}h</span>
                </div>
              ))}
            </div>

            <div className="flex justify-center items-center gap-2">
              <div className="w-4 h-4 bg-indigo-600 rounded"></div>
              <span className="text-sm font-medium text-gray-700">My Daily Calls</span>
            </div>
          </div>
        </div>

        {/* My Candidates Table */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="text-xl font-bold text-black">My Candidates ({getPeriodDisplayName()})</h3>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search candidate, note, location or company..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-72"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400" />
                <select
                  value={timePeriod}
                  onChange={handleTimePeriodChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  <option value="7days">Last 7 Days</option>
                  <option value="60days">Last 60 Days</option>
                  <option value="90days">Last 90 Days</option>
                  <option value="365days">Last 365 Days</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              
              {timePeriod === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="Start Date"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="End Date"
                  />
                  <button
                    onClick={handleCustomDateRange}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm"
                  >
                    Apply
                  </button>
                </div>
              )}
              
              <button
                onClick={() => {
                  setSelectedUserForViews({ id: user.id, name: user.name });
                  setShowViewedProfiles(true);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View My Profile Views
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Candidate Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Location</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Current Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Latest Note</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Total Calls</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Last Call (IST)</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                 </tr>
              </thead>
              <tbody>
                {filteredActivities.map((activity, index) => (
                  <tr key={activity.profile_id || activity.candidate_name || index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-black">
                        {activity.profile_name || activity.candidate_name || "N/A"}
                      </div>
                      {activity.company_name && <div className="text-sm text-gray-500 mt-1">{activity.company_name}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${getLocationColor(activity.candidate_location)}`}
                      >
                        {activity.candidate_location || "N/A"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(activity.status)}`}
                      >
                        {activity.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 max-w-xs">
                      <div className="truncate group relative">
                        {activity.note || "-"}
                        {activity.note && activity.note.length > 50 && (
                          <span className="text-xs text-indigo-600 ml-2 opacity-0 group-hover:opacity-100 transition">
                            (hover)
                          </span>
                        )}
                        <div className="absolute hidden group-hover:block z-50 bg-white p-4 border rounded-lg shadow-lg max-w-md mt-1">
                          {activity.note || "No notes"}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold">
                      {activity.total_calls || 1}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {formatDateIST(activity.created_at || activity.created_at_ist)}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => {
                          if (activity.user_id === user?.id) {
                            handleViewContact(activity);
                          } else {
                            handleViewCandidateLogs(activity);
                          }
                        }}
                        className={`px-4 py-1.5 rounded-lg flex items-center gap-2 text-sm ${
                          activity.user_id === user?.id
                            ? "bg-indigo-600 text-white hover:bg-indigo-700"
                            : "bg-green-600 text-white hover:bg-green-700"
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                        {activity.user_id === user?.id ? "Update Activity" : "View Call Logs"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredActivities.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-gray-500">
                      No candidates found matching your search criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

// Admin Status Charts Component with User Filter (OLD duplicate - DEPRECATED, use StatusChart instead)
const AdminStatusChartsDeprecated = () => {
    const [adminUsersForStatus, setAdminUsersForStatus] = useState([]);
    const allStatuses = ["in-progress", "cancelled", "closed", "follow-up", "updated"];
    const [selectedUserForStatus, setSelectedUserForStatus] = useState("all");
    const [filteredStatusData, setFilteredStatusData] = useState(departmentStatusData || []);
    
    const statusColors = {
      'in-progress': '#f59e0b',
      'cancelled': '#ef4444',
      'closed': '#10b981',
      'follow-up': '#3b82f6',
      'updated': '#8b5cf6'
    };
    
    const statusLabels = {
      'in-progress': 'In-Progress',
      'cancelled': 'Cancelled',
      'closed': 'Closed',
      'follow-up': 'Follow-up',
      'updated': 'Updated'
    };

    const [activeStatusFilters, setActiveStatusFilters] = useState(allStatuses);
    const [showStatusDetails, setShowStatusDetails] = useState(false);
    const [selectedStatusData, setSelectedStatusData] = useState([]);
    const [selectedStatusLabel, setSelectedStatusLabel] = useState('');
    const [loadingStatusDetails, setLoadingStatusDetails] = useState(false);
    
    // Get unique users for filter (prefer admin fetched users)
    const uniqueUsers = useCallback(() => {
      const source = adminUsersForStatus.length > 0 ? adminUsersForStatus : departmentStatusData || [];
      const usersMap = new Map();
      source.forEach(item => {
        if (item.user_id && item.user_name && !usersMap.has(item.user_id)) {
          usersMap.set(item.user_id, { id: item.user_id, name: item.user_name });
        }
      });
      return Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [departmentStatusData, adminUsersForStatus]);

  // User filter control for status chart (admin only)
  const UserFilterPanelForStatus = () => {
      if (!user?.is_admin) return null
      return (
        <div className="flex items-center gap-3 mt-2">
          <span className="text-sm text-gray-700">User</span>
          {/* <select
            value={selectedUserForStatus}
            onChange={(e) => setSelectedUserForStatus(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All Users</option>
            {uniqueUsers().map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select> */}
        </div>
      )
    }
    // Render the admin user filter panel if admin
    // Filter data when user selection changes
    useEffect(() => {
      if (selectedUserForStatus === "all") {
        setFilteredStatusData(departmentStatusData || []);
      } else {
        setFilteredStatusData((departmentStatusData || []).filter(
          item => item.user_id === parseInt(selectedUserForStatus)
        ));
      }
    }, [selectedUserForStatus, departmentStatusData]);

    // Load admin users for status dropdown (admin only)
    useEffect(() => {
      if (!user?.is_admin) return;
      const token = localStorage.getItem('token');
      (async () => {
        try {
          const res = await fetch(`${API_URL}/api/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          const data = await res.json()
          if (data?.success && Array.isArray(data?.users)) {
            setAdminUsersForStatus(data.users.map(u => ({ id: u.id, name: u.name })))
          }
        } catch (e) {
          // ignore
        }
      })()
    }, [user?.id, user?.is_admin, API_URL]);

    const filterDataByStatus = (data) => {
      return data.filter(item => activeStatusFilters.includes(item.status));
    };

    const departmentGroups = {
      BD: filterDataByStatus(filteredStatusData.filter(d => d.department === 'BD') || []),
      Recruit: filterDataByStatus(filteredStatusData.filter(d => d.department === 'Recruit') || []),
      Franchise: filterDataByStatus(filteredStatusData.filter(d => d.department === 'Franchise') || [])
    };
    
    const maxCounts = {
      BD: Math.max(...departmentGroups.BD.map(d => d.count), 1),
      Recruit: Math.max(...departmentGroups.Recruit.map(d => d.count), 1),
      Franchise: Math.max(...departmentGroups.Franchise.map(d => d.count), 1)
    };
    
    const chartHeight = 180;

    const fetchStatusDetails = async (status, department, userFilter = null) => {
      try {
        setLoadingStatusDetails(true);
        const token = localStorage.getItem("token");
        
        let dateParams = {};
        if (customDateRange) {
          dateParams = customDateRange;
        } else {
          dateParams = getDateRangeFromPeriod(timePeriod);
        }
        
        const params = new URLSearchParams({
          status: status,
          startDate: dateParams.startDate,
          endDate: dateParams.endDate
        });
        
        if (department && department !== "all") {
          params.append("department", department);
        }
        
        if (userFilter && userFilter !== "all") {
          params.append("user_id", userFilter);
        }
        
        const url = `${API_URL}/api/reports/status-details?${params.toString()}`;
        
        const response = await fetchWithRetry(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSelectedStatusData(data.data || []);
            setSelectedStatusLabel(`${statusLabels[status]} - ${department || "All Departments"}${userFilter !== "all" && userFilter ? ` - User Filtered` : ""}`);
            setShowStatusDetails(true);
          }
        }
      } catch (err) {
        console.error("Error fetching status details:", err);
      } finally {
        setLoadingStatusDetails(false);
      }
    };
    
    return (
      <>
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-bold text-black">Department Status Distribution</h3>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400" />
                <select
                  value={timePeriod}
                  onChange={handleTimePeriodChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  <option value="7days">Last 7 Days</option>
                  <option value="60days">Last 60 Days</option>
                  <option value="90days">Last 90 Days</option>
                  <option value="365days">Last 365 Days</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              {UserFilterPanelForStatus()}
              
              {timePeriod === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="Start Date"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="End Date"
                  />
                  <button
                    onClick={handleCustomDateRange}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
            
            {/* User Filter for Status Tab */}
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-gray-500" />
              {/* <select
                value={selectedUserForStatus}
                onChange={(e) => setSelectedUserForStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm min-w-[180px]"
              >
                <option value="all">All Users</option>
                {uniqueUsers().map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select> */}
              
              <div className="flex flex-wrap gap-2">
                {allStatuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      if (activeStatusFilters.includes(status)) {
                        if (activeStatusFilters.length > 1) {
                          setActiveStatusFilters(prev => prev.filter(s => s !== status));
                        }
                      } else {
                        setActiveStatusFilters(prev => [...prev, status]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      activeStatusFilters.includes(status)
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    {statusLabels[status]}
                  </button>
                ))}
                {activeStatusFilters.length < allStatuses.length && (
                  <button
                    onClick={() => setActiveStatusFilters(allStatuses)}
                    className="px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {filteredStatusData?.length > 0 ? (
            <div className="space-y-8">
              {['BD', 'Recruit', 'Franchise'].map((dept) => (
                <div key={dept} className="border rounded-xl p-6">
                  <h4 className="text-lg font-bold text-purple-800 mb-6">
                    {dept === 'BD' ? 'Business Development' : 
                     dept === 'Recruit' ? 'Recruitment' : 'Franchise Development'}
                  </h4>
                  <div className="h-64">
                    <div className="flex items-end h-48 border-b border-gray-200 px-4">
                      {allStatuses.filter(status => activeStatusFilters.includes(status)).map((status) => {
                        const deptData = departmentGroups[dept].find(d => d.status === status);
                        const count = deptData?.count || 0;
                        const barHeight = (count / maxCounts[dept]) * chartHeight;
                        
                        return (
                          <div key={status} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                            <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white rounded px-3 py-2 text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 shadow-lg">
                              <div className="font-semibold">{statusLabels[status]}</div>
                              <div className="mt-1">Count: {count}</div>
                              <div className="mt-1 text-xs text-gray-300">Click for details</div>
                            </div>
                            
                            <div
                              className="w-10 rounded-t-lg transition-all duration-300 hover:opacity-80 cursor-pointer hover:shadow-lg"
                              style={{
                                height: `${Math.max(barHeight, 4)}px`,
                                backgroundColor: statusColors[status] || '#6b7280',
                              }}
                              onClick={() => fetchStatusDetails(status, dept, selectedUserForStatus)}
                            ></div>
                            
                            {count > 0 && (
                              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-semibold">
                                {count}
                              </div>
                            )}
                            
                            <span className="text-xs font-medium text-gray-700 mt-2 capitalize text-center whitespace-nowrap">
                              {statusLabels[status]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-center mt-4 pt-2 border-t border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Status</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-40 h-40 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <BarChart3 className="w-16 h-16 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg">No department status data available</p>
              <p className="text-sm text-gray-400 mt-2">
                Status data will appear here once activities are logged by departments
              </p>
            </div>
          )}
        </div>

      {showStatusDetails && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4" onClick={() => setShowStatusDetails(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-indigo-800">Status Details: {selectedStatusLabel}</h2>
                  <p className="text-gray-600 mt-2">
                    Showing all candidates with this status
                  </p>
                </div>
                <button 
                  onClick={() => setShowStatusDetails(false)} 
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {loadingStatusDetails ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading status details...</p>
                  </div>
                ) : selectedStatusData.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">No Data Found</h3>
                    <p className="text-gray-500">
                      No candidates found with this status.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">User ID</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">User Name</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Department</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Candidate Name</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Company</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Location</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Total Calls</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Total Hours</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Last Activity</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                         </tr>
                      </thead>
                      <tbody>
                        {selectedStatusData.map((item, index) => (
                          <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 font-mono">{item.employee_id}</td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">{item.user_name}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDepartmentColor(item.department)}`}>
                                {item.department}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">{item.candidate_name}</div>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-700">
                              {item.company_name || "N/A"}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                                {item.candidate_location || "N/A"}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(item.status)}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-semibold">
                              {item.total_calls || 1}
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold">
                              {formatTime(item.total_call_hours)}
                            </td>
                            <td className="py-3 px-4 text-sm">
                              {formatDateIST(item.last_activity) || "N/A"}
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => {
                                  const userItem = {
                                    id: item.user_id,
                                    name: item.user_name,
                                    employee_id: item.employee_id,
                                    department: item.department,
                                    click_count: 0
                                  };
                                  handleViewUserLogs(userItem);
                                  setShowStatusDetails(false);
                                }}
                                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                              >
                                View Activity
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-4 text-sm text-gray-600">
                      Showing {selectedStatusData.length} records
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Click on any user's "View Activity" button to see detailed logs
                </div>
                <button
                  onClick={() => setShowStatusDetails(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  };

  // Personal Status Bar Chart (non-admin)
  const PersonalStatusBarChart = () => {
    const [selectedStatus, setSelectedStatus] = useState(null);
    
    const userActivities = (recentActivities || []).filter(activity => 
      activity.user_id === user?.id || 
      activity.user_name === user?.name
    );
    
    const getLatestStatusPerCandidate = () => {
      const candidateMap = {};
      
      userActivities.forEach(activity => {
        const key = activity.profile_id || activity.candidate_name;
        if (!key) return;
        
        if (!candidateMap[key] || new Date(activity.created_at) > new Date(candidateMap[key].created_at)) {
          candidateMap[key] = {
            ...activity,
            latest_status: activity.status
          };
        }
      });
      
      return Object.values(candidateMap);
    };
    
    const latestActivities = getLatestStatusPerCandidate();
    
    const personalStatusCounts = {};
    latestActivities.forEach(activity => {
      if (activity.latest_status) {
        const statusKey = activity.latest_status.toLowerCase().replace(' ', '-');
        personalStatusCounts[statusKey] = (personalStatusCounts[statusKey] || 0) + 1;
      }
    });
    
    const statusConfig = {
      'in-progress': { label: 'In-Progress', color: '#f59e0b' },
      'cancelled': { label: 'Cancelled', color: '#ef4444' },
      'closed': { label: 'Closed', color: '#10b981' },
      'follow-up': { label: 'Follow-up', color: '#3b82f6' },
      'updated': { label: 'Updated', color: '#8b5cf6' }
    };
    
    const allStatuses = Object.keys(statusConfig);
    
    const chartData = allStatuses.map(status => ({
      status,
      label: statusConfig[status].label,
      count: personalStatusCounts[status] || 0,
      color: statusConfig[status].color
    }));
    
    const selectedStatusData = selectedStatus ? chartData.find(d => d.status === selectedStatus) : null;
    
    const maxValue = Math.max(...chartData.map(d => d.count), 1);
    const chartHeight = 200;
    const scaleFactor = chartHeight / maxValue;
    const totalCandidates = latestActivities.length;
    
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-black">My Candidates by Status</h3>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <select
                value={timePeriod}
                onChange={handleTimePeriodChange}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                <option value="7days">Last 7 Days</option>
                <option value="60days">Last 60 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="365days">Last 365 Days</option>
                <option value="all">All Time</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            
            {timePeriod === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="Start Date"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="End Date"
                />
                <button
                  onClick={handleCustomDateRange}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
          
          <div className="text-sm text-gray-500">
            Total Candidates: {totalCandidates} | Period: {getPeriodDisplayName()}
          </div>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-2/3">
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-600">
                Current Status (Latest Activity Only)
              </h4>
            </div>
            
            <div className="h-72">
              <div className="flex items-end h-48 border-b border-gray-200 px-2">
                {chartData.map((item) => {
                  const barHeight = Math.max(item.count * scaleFactor, 4);
                  
                  return (
                    <div key={item.status} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                      <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white rounded px-3 py-2 text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 shadow-lg">
                        <div className="font-semibold">{item.label}</div>
                        <div className="mt-1">Candidates: {item.count}</div>
                        <div className="mt-1 text-xs text-gray-300">
                          {totalCandidates > 0 ? ((item.count / totalCandidates) * 100).toFixed(1) : 0}% of total
                        </div>
                      </div>
                      
                      <div className="relative w-full flex justify-center">
                        <div
                          className="w-10 rounded-t-lg transition-all duration-300 hover:opacity-90 cursor-pointer hover:shadow-lg"
                          style={{
                            height: `${barHeight}px`,
                            backgroundColor: item.color,
                          }}
                          onClick={() => setSelectedStatus(selectedStatus === item.status ? null : item.status)}
                        ></div>
                        {item.count > 0 && (
                          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-semibold">
                            {item.count}
                          </div>
                        )}
                      </div>
                      
                      <span className="text-xs font-medium text-gray-700 mt-3 text-center whitespace-nowrap">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              <div className="text-center mt-6 pt-3 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-600">Current Status</span>
              </div>
            </div>
          </div>
          
          <div className="lg:w-1/3">
            <div className="bg-gray-50 rounded-xl p-4 h-full">
              {selectedStatusData ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div 
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: selectedStatusData.color }}
                    ></div>
                    <h4 className="text-lg font-bold text-black">
                      {selectedStatusData.label}
                    </h4>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-sm text-gray-600 mb-1">Candidates</div>
                      <div className="text-2xl font-bold text-indigo-600">
                        {selectedStatusData.count}
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-sm text-gray-600 mb-1">Percentage</div>
                      <div className="text-2xl font-bold text-gray-700">
                        {totalCandidates > 0 
                          ? `${((selectedStatusData.count / totalCandidates) * 100).toFixed(1)}%` 
                          : '0%'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => setSelectedStatus(null)}
                      className="w-full px-3 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium text-sm"
                    >
                      Back to All Statuses
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Status Breakdown</h4>
                    <div className="space-y-3">
                      {chartData.map((item) => (
                        <div 
                          key={item.status} 
                          className="flex items-center justify-between p-3 bg-white rounded border hover:bg-gray-50 cursor-pointer transition"
                          onClick={() => setSelectedStatus(item.status)}
                        >
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded-sm"
                              style={{ backgroundColor: item.color }}
                            ></div>
                            <span className="text-sm text-gray-700">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-indigo-600">{item.count}</span>
                            <span className="text-xs text-gray-400">
                              ({totalCandidates > 0 ? ((item.count / totalCandidates) * 100).toFixed(0) : 0}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-semibold text-gray-700">Current Status:</span>
                    </p>
                    <ul className="text-xs text-gray-500 space-y-1.5 pl-1">
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5">•</span>
                        <span>Shows the latest status for each candidate</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5">•</span>
                        <span>When you update a candidate, status changes immediately</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5">•</span>
                        <span>Click any bar to see detailed statistics</span>
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-gray-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{totalCandidates}</div>
            <div className="text-xs text-gray-500">Total Candidates</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {latestActivities.filter(a => a.latest_status === 'closed').length}
            </div>
            <div className="text-xs text-gray-500">Closed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {latestActivities.filter(a => a.latest_status === 'in-progress').length}
            </div>
            <div className="text-xs text-gray-500">In-Progress</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {latestActivities.filter(a => a.latest_status === 'follow-up').length}
            </div>
            <div className="text-xs text-gray-500">Follow-up</div>
          </div>
        </div>
      </div>
    );
  };

  const StatusChart = () => {
    const isAdmin = user?.is_admin;
    // Use the deprecated admin distribution component to avoid recursive rendering
    return isAdmin ? <AdminStatusChartsDeprecated /> : <PersonalStatusBarChart />;
  };

  // Click Counts Tab Component
  const ClickCountsTab = () => {
    if (activeTab !== "clicks" || !user?.is_admin) return null;

    const sortedData = getSortedData();
    const totalClicks = sortedData.reduce((sum, user) => sum + (user.click_count || 0), 0);

    const trendDirection = clickCountsTrend.length >= 2 
      ? clickCountsTrend[clickCountsTrend.length - 1].value - clickCountsTrend[0].value
      : 0;

    const chartWidth = 800;
    const chartHeight = 250;
    const padding = 40;
    const graphWidth = chartWidth - padding * 2;
    const graphHeight = chartHeight - padding * 2;

    const maxTrendValue = Math.max(...clickCountsTrend.map(d => d.value), 1);
    const scaleY = (value) => graphHeight - (value / maxTrendValue) * graphHeight + padding;

    const points = clickCountsTrend.map((point, index) => {
      const divisor = clickCountsTrend.length > 1 ? clickCountsTrend.length - 1 : 1;
      const x = padding + (index / divisor) * graphWidth;
      const y = scaleY(point.value);
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="space-y-6">
        {lastUpdate && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-gray-500">
              Last updated: {formatDateIST(lastUpdate.toISOString())}
            </span>
            <span className="text-xs text-gray-500">
              | Department: {selectedDept === 'all' ? 'All Departments' : selectedDept}
            </span>
            <span className="text-xs text-gray-500">
              | Period: {getPeriodDisplayName()}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Click Counts</p>
                <h3 className="text-3xl font-bold text-black mt-2">
                  {totalClicks.toLocaleString()}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  All users in selected department
                </p>
              </div>
              <MousePointer className="w-10 h-10 text-indigo-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Users</p>
                <h3 className="text-3xl font-bold text-black mt-2">
                  {sortedData.filter(u => (u.unique_profile_views || u.click_count || 0) > 0).length}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Users with at least 1 click
                </p>
              </div>
              <Users className="w-10 h-10 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Clicks/User</p>
                <h3 className="text-3xl font-bold text-black mt-2">
                  {sortedData.length > 0 
                    ? (totalClicks / sortedData.length).toFixed(1)
                    : '0'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Average clicks per user
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Trend</p>
                <h3 className="text-3xl font-bold text-black mt-2 flex items-center gap-2">
                  {trendDirection > 0 ? (
                    <>
                      <ChevronUp className="w-8 h-8 text-green-600" />
                      <span className="text-green-600">+{Math.abs(trendDirection)}</span>
                    </>
                  ) : trendDirection < 0 ? (
                    <>
                      <ChevronDown className="w-8 h-8 text-red-600" />
                      <span className="text-red-600">{trendDirection}</span>
                    </>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Change over selected period
                </p>
              </div>
              <LineChart className="w-10 h-10 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="text-xl font-bold text-black flex items-center gap-2">
              <LineChart className="w-5 h-5" />
              Click Counts Trend
            </h3>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <select
                value={clickCountsPeriod}
                onChange={(e) => handleClickCountsPeriodChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          {clickCountsTrend.length > 0 ? (
            <div className="overflow-x-auto">
              <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="mx-auto">
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const y = padding + ratio * graphHeight;
                  const value = Math.round(maxTrendValue * (1 - ratio));
                  return (
                    <g key={i}>
                      <line
                        x1={padding}
                        y1={y}
                        x2={chartWidth - padding}
                        y2={y}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                        strokeDasharray="5,5"
                      />
                      <text
                        x={padding - 10}
                        y={y + 4}
                        textAnchor="end"
                        className="text-xs fill-gray-500"
                      >
                        {value}
                      </text>
                    </g>
                  );
                })}

                {clickCountsTrend.map((point, index) => {
                  const step = Math.ceil(clickCountsTrend.length / 5);
                  if (index % step !== 0) return null;
                  const divisor = clickCountsTrend.length > 1 ? clickCountsTrend.length - 1 : 1;
                  const x = padding + (index / divisor) * graphWidth;
                  return (
                    <text
                      key={index}
                      x={x}
                      y={chartHeight - padding + 20}
                      textAnchor="middle"
                      className="text-xs fill-gray-600"
                    >
                      {point.label}
                    </text>
                  );
                })}
                
                <polyline
                  points={points}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="3"
                />

                {clickCountsTrend.map((point, index) => {
                  const divisor = clickCountsTrend.length > 1 ? clickCountsTrend.length - 1 : 1;
                  const x = padding + (index / divisor) * graphWidth;
                  const y = scaleY(point.value);
                  return (
                    <g key={index} className="group">
                      <circle
                        cx={x}
                        cy={y}
                        r="6"
                        fill="#4f46e5"
                        stroke="white"
                        strokeWidth="2"
                        className="cursor-pointer hover:r-8 transition-all"
                      />
                      <title>{`${point.label}: ${point.value} clicks`}</title>
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="text-center py-12">
              <LineChart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No trend data available</p>
              <p className="text-sm text-gray-400 mt-2">
                Click data will appear here once users start viewing profiles
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="text-xl font-bold text-black flex items-center gap-2">
              <MousePointer className="w-5 h-5" />
              User Click Details
            </h3>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 w-64"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    const filtered = clickCountsData.filter(user => 
                      user.name?.toLowerCase().includes(e.target.value.toLowerCase()) ||
                      user.employee_id?.toLowerCase().includes(e.target.value.toLowerCase())
                    );
                    setClickCountsData(filtered);
                  }}
                />
              </div>
              
              <button
                onClick={() => {
                  setSearchQuery("");
                  fetchClickCountsData();
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Reset
              </button>
            </div>
          </div>

          {sortedData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-600 cursor-pointer hover:text-indigo-600"
                      onClick={() => handleSort('employee_id')}
                    >
                      User ID {sortConfig.key === 'employee_id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-600 cursor-pointer hover:text-indigo-600"
                      onClick={() => handleSort('name')}
                    >
                      User Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-600 cursor-pointer hover:text-indigo-600"
                      onClick={() => handleSort('department')}
                    >
                      Department {sortConfig.key === 'department' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-600 cursor-pointer hover:text-indigo-600"
                      onClick={() => handleSort('total_clicks')}
                    >
                      Total Clicks (All Time) {sortConfig.key === 'total_clicks' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                   </tr>
                </thead>
                <tbody>
                  {sortedData.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono font-medium text-black">{user.employee_id}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-black">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDepartmentColor(user.department)}`}>
                          {user.department}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-indigo-600" />
                          <span className="font-semibold text-indigo-700">
                            {user.click_count || 0}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            setSelectedUserForViews({ id: user.id, name: user.name });
                            setShowViewedProfiles(true);
                          }}
                          className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div className="mt-4 text-sm text-gray-600">
                Showing {sortedData.length} users
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <MousePointer className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No Click Data Found</h3>
              <p className="text-gray-500">
                No click data available for the selected period
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Updated Login Stats Tab with avg daily logins, logins today, logins all time
  const LoginStatsTab = () => {
    if (activeTab !== "logins" || !user?.is_admin) return null;

    const handleLoginSort = (key) => {
      let direction = 'desc';
      if (loginSortConfig.key === key && loginSortConfig.direction === 'desc') {
        direction = 'asc';
      }
      setLoginSortConfig({ key, direction });
    };

    const getSortedLoginData = () => {
      let filtered = [...loginData.users];

      if (loginSearch.trim() !== "") {
        filtered = filtered.filter(user => 
          user.name?.toLowerCase().includes(loginSearch.toLowerCase()) ||
          user.employee_id?.toLowerCase().includes(loginSearch.toLowerCase()) ||
          user.email?.toLowerCase().includes(loginSearch.toLowerCase())
        );
      }

      filtered.sort((a, b) => {
        let aValue, bValue;
        switch(loginSortConfig.key) {
          case 'name':
            aValue = a.name || '';
            bValue = b.name || '';
            break;
          case 'employee_id':
            aValue = a.employee_id || '';
            bValue = b.employee_id || '';
            break;
          case 'department':
            aValue = a.department || '';
            bValue = b.department || '';
            break;
          case 'login_count':
          default:
            aValue = a.login_count || 0;
            bValue = b.login_count || 0;
        }

        if (aValue < bValue) return loginSortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return loginSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });

      return filtered;
    };

    const sortedLoginData = getSortedLoginData();

    // Calculate total logins all time from user data
    const totalLoginsAllTime = sortedLoginData.reduce((sum, user) => sum + (user.total_logins_all_time || 0), 0);

    return (
      <div className="space-y-6">
        {lastUpdate && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-gray-500">
              Last updated: {formatDateIST(lastUpdate.toISOString())}
            </span>
            <span className="text-xs text-gray-500">
              | Department: {selectedDept === 'all' ? 'All Departments' : selectedDept}
            </span>
            <span className="text-xs text-gray-500">
              | Period: {getPeriodDisplayName()}
            </span>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Daily Logins</p>
                <h3 className="text-3xl font-bold text-black mt-2">
                  {loginData.avg_daily_logins || 0}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Average logins per day
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Logins Today</p>
                <h3 className="text-3xl font-bold text-green-600 mt-2">
                  {loginData.total_logins_today || 0}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {todayLogins.filter(l => l.user_id).length} unique users today
                </p>
              </div>
              <Users className="w-10 h-10 text-green-600" />
            </div>
          </div>

          { /* Logins All Time KPI removed as per request */ }
        </div>

        {/* Who Logged In Today Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="text-xl font-bold text-black flex items-center gap-2">
              <Users className="w-5 h-5" />
              Who Logged In Today
            </h3>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
              <button
                onClick={fetchTodayLogins}
                className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1 text-sm"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>
          </div>

          {todayLoginsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading today's logins...</p>
            </div>
          ) : todayLogins.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No logins recorded today</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">User ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">User Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Department</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Login Time (IST)</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Today's Logins</th>
                   </tr>
                </thead>
                <tbody>
                  {todayLogins.map((login, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4 font-mono font-medium text-black">{login.employee_id || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-black">{login.user_name}</div>
                        <div className="text-xs text-gray-500">{login.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDepartmentColor(login.department)}`}>
                          {login.department || '—'}
                        </span>
                      </td>
                    <td className="py-3 px-4 text-sm">
                        {login.last_login ? formatDateIST(login.last_login) : ''}
                    </td>
                    <td className="py-3 px-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-800 font-bold">
                          {login.login_count_today || 0}
                        </span>
                    </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 text-sm text-gray-600">
                Showing {todayLogins.length} unique users who logged in today
              </div>
            </div>
          )}
        </div>

        {/* User Login List */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="text-xl font-bold text-black flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Login Activity
            </h3>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID or email..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 w-64"
                  value={loginSearch}
                  onChange={(e) => setLoginSearch(e.target.value)}
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400" />
                <select
                  value={loginPeriod}
                  onChange={(e) => setLoginPeriod(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              
              <button
                onClick={() => {
                  setLoginSearch("");
                  fetchLoginStats();
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Reset
              </button>
            </div>
          </div>

          {loginLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading login statistics...</p>
            </div>
          ) : sortedLoginData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-600 cursor-pointer hover:text-indigo-600"
                      onClick={() => handleLoginSort('employee_id')}
                    >
                      User ID {loginSortConfig.key === 'employee_id' && (loginSortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-600 cursor-pointer hover:text-indigo-600"
                      onClick={() => handleLoginSort('name')}
                    >
                      User Name {loginSortConfig.key === 'name' && (loginSortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-600 cursor-pointer hover:text-indigo-600"
                      onClick={() => handleLoginSort('department')}
                    >
                      Department {loginSortConfig.key === 'department' && (loginSortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-600 cursor-pointer hover:text-indigo-600"
                      onClick={() => handleLoginSort('login_count')}
                    >
                      Logins ({getPeriodDisplayName()}) {loginSortConfig.key === 'login_count' && (loginSortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    
                  </tr>
                </thead>
                <tbody>
                  {sortedLoginData.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono font-medium text-black">{user.employee_id || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-black">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDepartmentColor(user.department)}`}>
                          {user.department || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${user.login_count > 0 ? 'text-indigo-700' : 'text-gray-400'}`}>
                            {user.login_count || 0}
                          </span>
                          
                        </div>
                      </td>
                    
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div className="mt-4 text-sm text-gray-600">
                Showing {sortedLoginData.length} users • {loginData.users.filter(u => u.login_count > 0).length} active in this period
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No Login Data Found</h3>
              <p className="text-gray-500">No login data available for the selected period</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Location Summary Component
  const LocationSummary = () => {
    const sortedLocationData = [...locationData].sort((a, b) => {
      return (b.callCount || 0) - (a.callCount || 0);
    });

    return (
      <>
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-bold text-black flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Location-wise Summary
              </h3>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400" />
                <select
                  value={timePeriod}
                  onChange={handleTimePeriodChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  <option value="7days">Last 7 Days</option>
                  <option value="60days">Last 60 Days</option>
                  <option value="90days">Last 90 Days</option>
                  <option value="365days">Last 365 Days</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              
              {timePeriod === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="Start Date"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="End Date"
                  />
                  <button
                    onClick={handleCustomDateRange}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
            
            <span className="text-sm text-gray-500">
              Total Locations: {sortedLocationData.length}
              {!user?.is_admin && " • Your activities only"}
            </span>
          </div>

          {locationStatsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading location data...</p>
            </div>
          ) : sortedLocationData.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {sortedLocationData.map((loc, index) => (
                  // Replace the existing location card div inside sortedLocationData.map()
<div
  key={loc.location}
  className={`border rounded-xl p-5 hover:shadow-md transition cursor-pointer ${getLocationColor(loc.location)}`}
  onClick={() => handleLocationClick(loc.location)}
>
  <div className="flex items-center justify-between mb-4">
    <h4 className="font-bold text-lg text-black">{loc.location}</h4>
    <MapPin className="w-5 h-5 text-blue-500" />
  </div>

  <div className="space-y-3">
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">Call Count</span>
      <span className="font-semibold text-black">{loc.callCount?.toLocaleString() || 0}</span>
    </div>

    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">Call Hours</span>
      <span className="font-semibold text-blue-600">{loc.callHours || 0} Hrs</span>
    </div>

    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">Unique Candidates</span>
      <span className="font-semibold text-purple-600">{loc.uniqueCandidates || 0}</span>
    </div>

    {/* STATUS BREAKDOWN */}
    <div className="pt-3 border-t border-gray-200">
      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Status Breakdown</p>
      <div className="space-y-1.5">
        {[
          { key: 'closed_count', label: 'Closed', color: 'text-green-600', bg: 'bg-green-100' },
          { key: 'in_progress_count', label: 'In-Progress', color: 'text-yellow-600', bg: 'bg-yellow-100' },
          { key: 'follow_up_count', label: 'Follow-up', color: 'text-blue-600', bg: 'bg-blue-100' },
          { key: 'cancelled_count', label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-100' },
          { key: 'updated_count', label: 'Updated', color: 'text-purple-600', bg: 'bg-purple-100' },
          { key: 'pending_count', label: 'Pending', color: 'text-gray-600', bg: 'bg-gray-100' },
        ].map(({ key, label, color, bg }) => {
          const count = loc[key] || 0;
          if (count === 0) return null;
          return (
            <div key={key} className="flex justify-between items-center">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bg} ${color}`}>
                {label}
              </span>
              <span className={`text-xs font-bold ${color}`}>{count}</span>
            </div>
          );
        })}
        {/* Fallback if no status keys available */}
        {!loc.closed_count && !loc.in_progress_count && !loc.follow_up_count && 
         !loc.cancelled_count && !loc.updated_count && !loc.pending_count && 
         loc.closed_count !== undefined && (
          <p className="text-xs text-gray-400 italic">No status breakdown available</p>
        )}
      </div>
    </div>

    <div className="pt-2 border-t border-gray-200">
      <div className="text-xs text-gray-500">
        {loc.callCount > 0 && loc.callHours > 0
          ? `Avg: ${((loc.callHours / loc.callCount) * 60).toFixed(1)} min/call`
          : loc.callCount > 0 ? "No call duration data" : "No calls"}
      </div>
      <div className="text-xs text-blue-600 mt-1">
        Click for details →
      </div>
    </div>
  </div>
</div>
                ))}
              </div>
              
              <div className="mt-6 text-sm text-gray-500">
                Showing {sortedLocationData.length} location(s) with call activity
                {selectedDept !== "all" && ` • Department: ${selectedDept}`}
                {' '}• Period: {getPeriodDisplayName()}
                {!user?.is_admin && " • Your activities only"}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="w-40 h-40 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <MapPin className="w-16 h-16 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg">No call activity by location</p>
              <p className="text-sm text-gray-400 mt-2">
                {user?.is_admin 
                  ? "Location data will appear here once calls are logged with location information"
                  : "You haven't logged any calls with location information yet"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Selected period: {getPeriodDisplayName()}
              </p>
            </div>
          )}
        </div>

        {showLocationDetails && (
          <LocationDetailsPopup 
            location={selectedLocation}
            data={locationDetailsData}
            departmentFilter={selectedDept}
            timePeriod={timePeriod}
            customDateRange={customDateRange}
            getDepartmentColor={getDepartmentColor}
            getStatusColor={getStatusColor}
            formatTime={formatTime}
            formatDateIST={formatDateIST}
            handleViewContact={handleViewContact}
            onClose={() => {
              setShowLocationDetails(false);
              setLocationDetailsData([]);
              setSelectedLocation(null);
            }}
            isAdmin={user?.is_admin}
            userId={user?.id}
          />
        )}
      </>
    );
  };

  const UserLogsPopup = () => {
    if (!showUserLogs || !selectedUser) return null;

    const filteredActivities = userActivities.filter((activity) => activity.user_id === selectedUser.id);

    const handleExport = async () => {
      if (!selectedUser) return;
      await handleExportUserActivity(selectedUser.id, selectedUser.name);
    };

    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-indigo-800">Activity Report for {selectedUser.name}</h2>
              <p className="text-gray-600">
                <span className="font-medium">Department:</span> {selectedUser.department} |
                <span className="font-medium ml-4">User ID:</span> {selectedUser.employee_id} |
                <span className="font-medium ml-4">Profile Views:</span> {selectedUser.click_count || 0}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                <select
                  value={timePeriod}
                  onChange={handleTimePeriodChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                >
                  <option value="7days">Last 7 Days</option>
                  <option value="60days">Last 60 Days</option>
                  <option value="90days">Last 90 Days</option>
                  <option value="365days">Last 365 Days</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              
              {timePeriod === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="Start Date"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="End Date"
                  />
                  <button
                    onClick={handleCustomDateRange}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm"
                  >
                    Apply
                  </button>
                </div>
              )}
              
              <button onClick={() => setShowUserLogs(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          <div className="p-4 border-b bg-white">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search candidate, location, date, or status..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-indigo-500"
                    value={userLogsSearch}
                    onChange={(e) => {
                      setUserLogsSearch(e.target.value)
                      setTimeout(() => {
                        fetchUserActivities(selectedUser.id, showAllLogs, e.target.value, userLogsStatus)
                      }, 300)
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  value={userLogsStatus}
                  onChange={(e) => {
                    setUserLogsStatus(e.target.value)
                    fetchUserActivities(selectedUser.id, showAllLogs, userLogsSearch, e.target.value)
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="in-progress">In-Progress</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="closed">Closed</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="updated">Updated</option>
                  <option value="pending">Pending</option>
                </select>
                <button
                  onClick={() => {
                    setUserLogsSearch("")
                    setUserLogsStatus("all")
                    fetchUserActivities(selectedUser.id, showAllLogs, "", "all")
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="overflow-x-auto">
              {userActivities.length > 0 ? (
                <>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {user?.is_admin ? (
                          <>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Candidate Name</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Company</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Location</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Total Calls</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Latest Status</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Total Hours</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Latest Date (IST)</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                          </>
                        ) : (
                          <>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Date (IST)</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Candidate Name</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Location</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Duration</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActivities.map((activity, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          {user?.is_admin ? (
                            <>
                              <td className="py-3 px-4">
                                <div className="font-medium text-gray-900">
                                  {activity.candidate_name || activity.profile_name || "Unknown"}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600">
                                {activity.company_name || "—"}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                                  {activity.candidate_location || "—"}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="font-semibold">{activity.total_calls || 1}</span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(activity.status)}`}>
                                  {activity.status || "—"}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono font-semibold text-gray-800">
                                {formatTime(activity.total_call_hours) || "0h 0m"}
                              </td>
                              <td className="py-3 px-4 text-sm">
                                {formatDateIST(activity.created_at) || "—"}
                              </td>
                              <td className="py-3 px-4">
                                <button
                                  onClick={() => {
                                    if (activity.user_id === user?.id) {
                                      handleViewContact(activity);
                                    } else {
                                      handleViewCandidateLogs(activity);
                                    }
                                  }}
                                  className={`px-4 py-1.5 rounded-lg flex items-center gap-2 text-sm ${
                                    activity.user_id === user?.id
                                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                      : "bg-green-600 text-white hover:bg-green-700"
                                  }`}
                                >
                                  <Eye className="w-4 h-4" />
                                  {activity.user_id === user?.id ? "Update Activity" : "View Call Logs"}
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-4 text-sm">
                                {formatDateIST(activity.created_at) || "—"}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-medium text-gray-900">
                                  {activity.candidate_name || activity.profile_name || "—"}
                                </div>
                                {activity.company_name && activity.company_name !== "—" && (
                                  <div className="text-xs text-gray-500 mt-1">{activity.company_name}</div>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                                  {activity.candidate_location || activity.location || "—"}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono font-semibold text-gray-800">
                                {formatTime(activity.duration) || "0h 0m"}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(activity.status)}`}
                                >
                                  {activity.status || "—"}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <button
                                  onClick={() => handleViewCandidateLogs(activity)}
                                  className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                >
                                  View Call Logs
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <div className="mt-4 text-sm text-gray-600">
                    Showing {userActivities.length} records (Sorted by latest date)
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Clock className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No Activities Found</h3>
                  <p className="text-gray-500">
                    No activities logged for this user in the selected time period
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {filteredActivities.length} records
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
              >
                Export Logs
              </button>
              <button
                onClick={() => setShowUserLogs(false)}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const CandidateLogsPopup = () => {
    if (!showCandidateLogs || !selectedCandidateLogs) return null;

    const { candidate_name, user_name, employee_id, department, profile_id, call_logs, total_calls } = selectedCandidateLogs;

    const getNoteText = (log) => {
      const note = log.note || log.notes || log.activity_note || log.call_notes || log.comments || "";
      if (!note || note === "" || note === "null" || note === "undefined") {
        return null;
      }
      return String(note).trim();
    };

    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-indigo-800">Call Logs for {candidate_name}</h2>
              <p className="text-gray-600 mt-2">
                <span className="font-medium">User:</span> {user_name} ({employee_id}) |
                <span className="font-medium ml-4">Department:</span> {department} |
                <span className="font-medium ml-4">Total Calls:</span> {total_calls} |
                <span className="font-medium ml-4">Period:</span> {getPeriodDisplayName()}
              </p>
            </div>
            <button 
              onClick={() => {
                setShowCandidateLogs(false);
                setSelectedCandidateLogs(null);
              }} 
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {call_logs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Date & Time (IST)</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Duration</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Note</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {call_logs.map((log, index) => {
                      const noteText = getNoteText(log);
                      
                      return (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm">
                            {formatDateIST(log.created_at) || formatDateIST(log.created_at_ist) || "N/A"}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-gray-800">
                            {formatTime(log.duration) || "0h 0m"}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(log.status)}`}>
                              {log.status || "N/A"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700 max-w-md">
                            {noteText ? (
                              <div className="group relative">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 hover:bg-blue-100 transition-colors cursor-default">
                                  <p className="text-gray-800 whitespace-pre-wrap break-words">
                                    {noteText.length > 100 ? (
                                      <>
                                        {noteText.substring(0, 100)}...
                                        <span className="ml-2 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                          (hover to see full)
                                        </span>
                                      </>
                                    ) : (
                                      noteText
                                    )}
                                  </p>
                                </div>
                                {noteText.length > 100 && (
                                  <div className="absolute left-0 top-full mt-2 z-50 hidden group-hover:block">
                                    <div className="bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-xl">
                                      <p className="text-gray-800 text-sm whitespace-pre-wrap break-words">{noteText}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                              {log.candidate_location || "N/A"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                <div className="mt-4 text-sm text-gray-600">
                  Showing {call_logs.length} call logs
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Clock className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">No Call Logs Found</h3>
                <p className="text-gray-500">
                  No call history found for {candidate_name} in the selected time period
                </p>
              </div>
            )}
          </div>

          <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Profile ID: {profile_id}
            </div>
            <button
              onClick={() => {
                setShowCandidateLogs(false);
                setSelectedCandidateLogs(null);
              }}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Viewed Profiles Popup
  const ViewedProfilesPopup = () => {
    const [localTimePeriod, setLocalTimePeriod] = useState("all");
    const [localCustomDateRange, setLocalCustomDateRange] = useState(null);
    const [localStartDate, setLocalStartDate] = useState("");
    const [localEndDate, setLocalEndDate] = useState("");
    const [localLoading, setLocalLoading] = useState(false);
    const [localData, setLocalData] = useState(null);
    
    const hasFetchedRef = useRef(false);

    if (!showViewedProfiles || !selectedUserForViews) return null;

    const getLocalDateRange = () => {
      if (localCustomDateRange) {
        return localCustomDateRange;
      }
      
      const now = new Date();
      const endDateISO = now.toISOString().split('T')[0];
      let startDateISO;
      
      switch(localTimePeriod) {
        case '60days':
          startDateISO = new Date(now.setDate(now.getDate() - 60)).toISOString().split('T')[0];
          break;
        case '90days':
          startDateISO = new Date(now.setDate(now.getDate() - 90)).toISOString().split('T')[0];
          break;
        case '365days':
          startDateISO = new Date(now.setDate(now.getDate() - 365)).toISOString().split('T')[0];
          break;
        case 'all':
          startDateISO = '2020-01-01';
          break;
        case '7days':
        default:
          startDateISO = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
      }
      
      return { startDate: startDateISO, endDate: endDateISO };
    };

    const formatDateOnly = (dateString) => {
      if (!dateString) return "N/A";
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      } catch (error) {
        return dateString;
      }
    };

    const getLocalPeriodDisplayName = () => {
      if (localCustomDateRange) {
        return `${formatDateOnly(localCustomDateRange.startDate)} to ${formatDateOnly(localCustomDateRange.endDate)}`;
      }
      switch(localTimePeriod) {
        case '60days': return 'Last 60 Days';
        case '90days': return 'Last 90 Days';
        case '365days': return 'Last 365 Days';
        case 'all': return 'All Time';
        case '7days': return 'Last 7 Days';
        default: return 'Last 7 Days';
      }
    };

    const fetchViewedProfiles = useCallback(async () => {
      if (!selectedUserForViews?.id || localLoading) return;

      try {
        setLocalLoading(true);
        const dateRange = getLocalDateRange();
        
        const token = localStorage.getItem("token");
        const url = `${API_URL}/api/reports/viewed-profiles/${selectedUserForViews.id}?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setLocalData(data.data);
          } else {
            throw new Error(data.message || "Failed to load");
          }
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (err) {
        console.error("Error fetching viewed profiles:", err);
        alert("Failed to load viewed profiles: " + err.message);
      } finally {
        setLocalLoading(false);
      }
    }, [selectedUserForViews?.id, localTimePeriod, localCustomDateRange]);

    useEffect(() => {
      if (showViewedProfiles && selectedUserForViews?.id) {
        fetchViewedProfiles();
      }
    }, [showViewedProfiles, selectedUserForViews?.id, fetchViewedProfiles]);

    const handlePeriodChange = (e) => {
      const val = e.target.value;
      setLocalTimePeriod(val);
      if (val !== "custom") {
        setLocalCustomDateRange(null);
        setLocalStartDate("");
        setLocalEndDate("");
      }
    };

    const handleCustomDateApply = () => {
      if (localStartDate && localEndDate) {
        setLocalCustomDateRange({
          startDate: localStartDate,
          endDate: localEndDate
        });
      } else {
        alert("Please select both start and end dates");
      }
    };

    const handleClose = () => {
      setShowViewedProfiles(false);
      setSelectedUserForViews(null);
      setLocalData(null);
      setLocalTimePeriod("all");
      setLocalCustomDateRange(null);
      setLocalStartDate("");
      setLocalEndDate("");
      hasFetchedRef.current = false;
    };

    const profiles = localData?.profiles || [];
    const summary = localData?.summary || {
      total_views: 0,
      unique_profiles: 0,
      first_view: null,
      last_view: null,
    };

    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-indigo-800">
                Profiles Viewed by {selectedUserForViews.name}
              </h2>
              <p className="text-gray-600 mt-2">
                <span className="font-medium">Period:</span> {getLocalPeriodDisplayName()} |
                <span className="font-medium ml-4">Total Views:</span> {summary.total_views || 0} |
                <span className="font-medium ml-4">Unique Profiles:</span> {summary.unique_profiles || 0}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                <select
                  value={localTimePeriod}
                  onChange={handlePeriodChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                >
                  <option value="7days">Last 7 Days</option>
                  <option value="60days">Last 60 Days</option>
                  <option value="90days">Last 90 Days</option>
                  <option value="365days">Last 365 Days</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {localTimePeriod === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={localStartDate}
                    onChange={(e) => setLocalStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="Start Date"
                  />
                  <input
                    type="date"
                    value={localEndDate}
                    onChange={(e) => setLocalEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="End Date"
                  />
                  <button
                    onClick={handleCustomDateApply}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm"
                  >
                    Apply
                  </button>
                </div>
              )}

              <button
                onClick={handleClose}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="p-4 border-b bg-blue-50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700">{summary.total_views ?? 0}</div>
                <div className="text-sm text-blue-600">Total Views</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">{summary.unique_profiles ?? 0}</div>
                <div className="text-sm text-green-600">Unique Profiles</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-700">First View</div>
                {summary.total_views === 0 ? (
                  <p className="text-sm font-medium text-gray-900">No views yet</p>
                ) : summary.first_view ? (
                  <p className="text-sm font-medium text-gray-900">{summary.first_view}</p>
                ) : (
                  <p className="text-sm font-medium text-amber-700">Date not available</p>
                )}
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-700">Last View</div>
                {summary.total_views === 0 ? (
                  <p className="text-sm font-medium text-gray-900">No views yet</p>
                ) : summary.last_view ? (
                  <p className="text-sm font-medium text-gray-900">{summary.last_view}</p>
                ) : (
                  <p className="text-sm font-medium text-amber-700">Date not available</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {localLoading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-700 mx-auto mb-6"></div>
                <h3 className="text-lg font-medium text-indigo-700">Loading viewed profiles...</h3>
                <p className="mt-2 text-sm text-gray-500">
                  for period: {getLocalPeriodDisplayName()}
                </p>
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-12">
                <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">No Profiles Viewed</h3>
                <p className="text-gray-500">
                  No profile views found for {selectedUserForViews.name} in the selected period.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                        Date & Time (IST)
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                        Profile Name
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                        Company
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                        Location
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                        Contact
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                        Views by User
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                        Total Views
                      </th>
                     </tr>
                  </thead>
                  <tbody>
                    {profiles.map((profile) => (
                      <tr key={profile.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">
                          {profile.last_viewed_formatted ? (
                            <>
                              <div className="font-medium">{profile.last_viewed_formatted.split(' ')[0]}</div>
                              <div className="text-xs text-gray-500">
                                {profile.last_viewed_formatted.split(' ').slice(1).join(' ')}
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                         </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{profile.profile_name}</div>
                          {profile.designation !== "—" && (
                            <div className="text-xs text-gray-500">{profile.designation}</div>
                          )}
                         </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-700">{profile.company_name}</div>
                         </td>
                        <td className="py-3 px-4">
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            {profile.location}
                          </span>
                         </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <div className="text-gray-700">{profile.phone}</div>
                            <div className="text-gray-600 truncate max-w-xs">{profile.email}</div>
                          </div>
                         </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                            {profile.views_by_user || 0}
                          </span>
                         </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-800 font-bold">
                            {profile.total_views_all_users || 0}
                          </span>
                         </td>
                       </tr>
                    ))}
                  </tbody>
                 </table>

                <div className="mt-4 text-sm text-gray-600">
                  Showing {profiles.length} profile views for {selectedUserForViews.name} in{" "}
                  {getLocalPeriodDisplayName()}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {user?.is_admin
                ? "View detailed profile view history"
                : "Your profile view history"}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const csvData = profiles.map((p) => ({
                    Date: p.last_viewed_formatted ? p.last_viewed_formatted.split(' ')[0] : "N/A",
                    Time: p.last_viewed_formatted ? p.last_viewed_formatted.split(' ').slice(1).join(' ') : "N/A",
                    Profile: p.profile_name,
                    Company: p.company_name,
                    Location: p.location,
                    Phone: p.phone,
                    Email: p.email,
                    "Views by User": p.views_by_user || 0,
                    "Total Views": p.total_views_all_users || 0,
                    Viewer: p.viewer_name,
                    Department: p.viewer_department,
                  }));

                  if (csvData.length > 0) {
                    const headers = Object.keys(csvData[0]).join(",");
                    const rows = csvData.map((row) =>
                      Object.values(row)
                        .map((value) => `"${(value || "").toString().replace(/"/g, '""')}"`)
                        .join(",")
                    );
                    const csv = [headers, ...rows].join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const link = document.createElement("a");
                    const url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    link.setAttribute(
                      "download",
                      `viewed_profiles_${selectedUserForViews.name}_${Date.now()}.csv`
                    );
                    link.style.visibility = "hidden";
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center gap-2"
                disabled={profiles.length === 0}
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const EmailLogsComponent = () => {
    const filteredEmailLogs = emailLogs.filter(log => 
      emailSearch === "" ||
      (log.candidate_name && log.candidate_name.toLowerCase().includes(emailSearch.toLowerCase())) ||
      (log.candidate_email && log.candidate_email.toLowerCase().includes(emailSearch.toLowerCase())) ||
      (log.user_name && log.user_name.toLowerCase().includes(emailSearch.toLowerCase())) ||
      (log.email_subject && log.email_subject.toLowerCase().includes(emailSearch.toLowerCase())) ||
      (log.reply_to_email && log.reply_to_email.toLowerCase().includes(emailSearch.toLowerCase()))
    );

    const getEmailStatusColor = (status) => {
      switch(status) {
        case 'sent': return 'bg-green-100 text-green-800 border-green-200';
        case 'failed': return 'bg-red-100 text-red-800 border-red-200';
        case 'opened': return 'bg-blue-100 text-blue-800 border-blue-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-bold text-black flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Logs
              </h3>
              <span className="text-sm text-gray-500">
                Period: {getPeriodDisplayName()}
              </span>
            </div>
            
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400" />
                <select
                  value={timePeriod}
                  onChange={handleTimePeriodChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  <option value="7days">Last 7 Days</option>
                  <option value="60days">Last 60 Days</option>
                  <option value="90days">Last 90 Days</option>
                  <option value="365days">Last 365 Days</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              
              {timePeriod === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="Start Date"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="End Date"
                  />
                  <button
                    onClick={handleCustomDateRange}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm"
                  >
                    Apply
                  </button>
                </div>
              )}
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search candidate, email, subject, or reply to..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 w-80"
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                />
              </div>
              
              <button
                onClick={() => {
                  emailFetchedRef.current = false;
                  fetchEmailLogs();
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                disabled={emailLogsLoading}
              >
                <RefreshCw className={`w-4 h-4 ${emailLogsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {!emailLogsLoading && emailLogs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <div className="text-sm text-gray-600">Total Emails</div>
                <div className="text-2xl font-bold text-black">{emailLogs.length}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <div className="text-sm text-gray-600">Sent Successfully</div>
                <div className="text-2xl font-bold text-green-600">
                  {emailLogs.filter(e => e.status === 'sent').length}
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <div className="text-sm text-gray-600">Failed</div>
                <div className="text-2xl font-bold text-red-600">
                  {emailLogs.filter(e => e.status === 'failed').length}
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <div className="text-sm text-gray-600">Unique Candidates</div>
                <div className="text-2xl font-bold text-blue-600">
                  {[...new Set(emailLogs.map(e => e.candidate_email))].length}
                </div>
              </div>
            </div>
          )}

          {emailLogsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading email logs...</p>
            </div>
          ) : filteredEmailLogs.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No email logs found</p>
              <p className="text-sm text-gray-400 mt-2">
                Email logs will appear here when emails are sent
                {user?.is_admin ? ` for ${selectedDept === 'all' ? 'all departments' : selectedDept}` : ' by you'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Date & Time (IST)</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Candidate</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Subject</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Sent By</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Reply To</th>
                   </tr>
                </thead>
                <tbody>
                  {filteredEmailLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">
                        {formatDateIST(log.sent_at) || "N/A"}
                       </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-black">{log.candidate_name}</div>
                        {log.profile_name && log.profile_name !== log.candidate_name && (
                          <div className="text-xs text-gray-500 mt-1">Profile: {log.profile_name}</div>
                        )}
                       </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {log.candidate_email}
                       </td>
                      <td className="py-3 px-4 text-sm text-gray-700 max-w-xs">
                        <div className="truncate group relative">
                          {log.email_subject || "No subject"}
                          {log.email_subject && log.email_subject.length > 50 && (
                            <div className="absolute hidden group-hover:block z-50 bg-white p-2 border rounded shadow-lg max-w-md mt-1 text-xs">
                              {log.email_subject}
                            </div>
                          )}
                        </div>
                       </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          <div className="font-medium">{log.user_name}</div>
                          <div className="text-xs text-gray-500">{log.department}</div>
                          <div className="text-xs text-gray-400">{log.employee_id}</div>
                        </div>
                       </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getEmailStatusColor(log.status)}`}>
                          {log.status || "unknown"}
                        </span>
                       </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {log.reply_to_email || "N/A"}
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
              
              <div className="mt-4 text-sm text-gray-600">
                Showing {filteredEmailLogs.length} of {emailLogs.length} email logs
                {user?.is_admin && selectedDept !== 'all' && ` • Department: ${selectedDept}`}
              </div>
            </div>
          )}
        </div>
        
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center">
              <button
                onClick={() => navigate("/dashboard")}
                className="text-gray-600 hover:text-black flex items-center gap-2"
              >
                <Home className="w-5 h-5" />
                Back to Dashboard
              </button>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h1 className="text-2xl font-bold text-black">REPORTS</h1>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncData}
                    disabled={syncing}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? "Syncing..." : "Sync"}
                  </button>
                  <button
                    onClick={() => {
                      const csvData = user?.is_admin ? filteredUsers : filteredActivities
                      if (csvData && csvData.length > 0) {
                        const headers = Object.keys(csvData[0]).join(",")
                        const rows = csvData.map((row) =>
                          Object.values(row)
                            .map((value) => `"${(value || "").toString().replace(/"/g, '""')}"`)
                            .join(",")
                        )
                        const csv = [headers, ...rows].join("\n")
                        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
                        const link = document.createElement("a")
                        const url = URL.createObjectURL(blob)
                        link.setAttribute("href", url)
                        link.setAttribute("download", `report_${Date.now()}.csv`)
                        link.style.visibility = "hidden"
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      }
                    }}
                    disabled={exporting}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    {exporting ? "Exporting..." : "Export Report"}
                  </button>
                </div>
                <div className="bg-gray-100 px-4 py-2 rounded-lg">
                  <p className="text-sm text-gray-600">Logged in as</p>
                  <p className="font-semibold text-black">
                    {user?.name} ({user?.employee_id})
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {user?.is_admin && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-700">Department Filter</span>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-60 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">All Departments</option>
                    <option value="BD">Business Development</option>
                    <option value="Recruit">Recruitment (Franchise)</option>
                    <option value="Franchise">Franchise Development</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleResetFilters}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex space-x-1 bg-white rounded-xl p-1 border border-gray-200">
          {[
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "status", label: "Status", icon: MessageSquare },
            { id: "clicks", label: "Click Counts", icon: MousePointer },
            { id: "logins", label: "Login Stats", icon: Users },
            { id: "location", label: "Location Summary", icon: MapPin },
            { id: "emaillogs", label: "Email Logs", icon: Mail },
          ]
            .filter(tab => !(tab.id === 'clicks' && !user?.is_admin) && !(tab.id === 'logins' && !user?.is_admin))
            .map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition
                ${activeTab === tab.id ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "overview" && (
          <div className="space-y-8">{user?.is_admin ? <AdminOverview /> : <DepartmentOverview />}</div>
        )}

        {activeTab === "status" && <StatusChart />}

        {activeTab === "clicks" && <ClickCountsTab />}

        {activeTab === "logins" && <LoginStatsTab />}

        {activeTab === "location" && <LocationSummary />}

        {activeTab === "emaillogs" && <EmailLogsComponent />}
      </div>

      <div className="border-t bg-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-500">
            Reports generated on {formatDateIST(new Date().toISOString())} | Period: {getPeriodDisplayName()}
          </div>
        </div>
      </div>

      {/* Replace the <UserLogsPopup /> line with this code */}
{showUserLogs && selectedUser && (
  <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
      <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-indigo-800">Activity Report for {selectedUser.name}</h2>
          <p className="text-gray-600">
            <span className="font-medium">Department:</span> {selectedUser.department} |
            <span className="font-medium ml-4">User ID:</span> {selectedUser.employee_id} |
            <span className="font-medium ml-4">Profile Views:</span> {selectedUser.click_count || 0}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <select
              value={timePeriod}
              onChange={handleTimePeriodChange}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
            >
              <option value="7days">Last 7 Days</option>
              <option value="60days">Last 60 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="365days">Last 365 Days</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          
          {timePeriod === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <button
                onClick={handleCustomDateRange}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm"
              >
                Apply
              </button>
            </div>
          )}
          
          <button onClick={() => setShowUserLogs(false)} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      <div className="p-4 border-b bg-white">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search candidate, location, date, or status..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-indigo-500"
                value={userLogsSearch}
                onChange={(e) => {
                  setUserLogsSearch(e.target.value)
                  fetchUserActivities(selectedUser.id, showAllLogs, e.target.value, userLogsStatus)
                }}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              value={userLogsStatus}
              onChange={(e) => {
                setUserLogsStatus(e.target.value)
                fetchUserActivities(selectedUser.id, showAllLogs, userLogsSearch, e.target.value)
              }}
            >
              <option value="all">All Status</option>
              <option value="in-progress">In-Progress</option>
              <option value="cancelled">Cancelled</option>
              <option value="closed">Closed</option>
              <option value="follow-up">Follow-up</option>
              <option value="updated">Updated</option>
              <option value="pending">Pending</option>
            </select>
            <button
              onClick={() => {
                setUserLogsSearch("")
                setUserLogsStatus("all")
                fetchUserActivities(selectedUser.id, showAllLogs, "", "all")
              }}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="overflow-x-auto">
          {(() => {
            const displayActivities = userLogsStatus === "all"
              ? userActivities
              : userActivities.filter(a => a.status === userLogsStatus);
            return displayActivities.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Candidate Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Company</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Location</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Total Calls</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Latest Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Total Hours</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Latest Date (IST)</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
             {displayActivities.map((activity, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{activity.candidate_name || "Unknown"}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{activity.company_name || "—"}</td>
                    <td className="py-3 px-4"><span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{activity.candidate_location || "—"}</span></td>
                    <td className="py-3 px-4 text-center font-semibold">{activity.total_calls || 1}</td>
                    <td className="py-3 px-4"><span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(activity.status)}`}>{activity.status || "—"}</span></td>
                    <td className="py-3 px-4 font-mono font-semibold">{formatTime(activity.total_call_hours)}</td>
                    <td className="py-3 px-4 text-sm">{formatDateIST(activity.created_at)}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleViewCandidateLogs(activity)}
                        className="px-4 py-1.5 bg-green-600 text-white rounded-lg flex items-center gap-2 text-sm"
                      >
                        <Eye className="w-4 h-4" /> View Call Logs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No activities found</p>
            </div>
          );
          })()}
        </div>
      </div>
      <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
        <div className="text-sm text-gray-600">Showing {userActivities.length} records</div>
        <button onClick={() => setShowUserLogs(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300">Close</button>
      </div>
    </div>
  </div>
)}
      <ViewedProfilesPopup />
      <CandidateLogsPopup />
      <UpdatedCandidatesPopup />
      {showContactPopup && selectedContact && (
        <ContactPopup
          profile={selectedContact}
          candidateConflict={candidateConflict}
          onClose={() => {
            setShowContactPopup(false);
            setSelectedContact(null);
            setCandidateConflict(null);
            setTimeout(() => {
              fetchReportData();
            }, 500);
            if (reportData) {
              if (!user?.is_admin) {
                const latestActivities = getLatestActivitiesPerCandidate(reportData.recentActivities || []);
                setFilteredActivities(latestActivities);
              } else {
                setFilteredUsers(reportData.userPerformance || []);
                setFilteredActivities(reportData.recentActivities || []);
              }
            }
          }}
        />
      )}
    </div>
  )
}

// Location Details Popup Component
const LocationDetailsPopup = ({ 
  location, 
  data, 
  departmentFilter, 
  timePeriod,
  customDateRange,
  onClose,
  getDepartmentColor,
  getStatusColor,
  formatTime,
  formatDateIST,
  handleViewContact,
  isAdmin,
  userId
}) => {
  const getPeriodDisplayName = () => {
    if (customDateRange) {
      const formatDateOnly = (dateString) => {
        if (!dateString) return "N/A";
        try {
          const date = new Date(dateString);
          if (isNaN(date.getTime())) return dateString;
          const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
          const day = istDate.getUTCDate().toString().padStart(2, '0');
          const month = (istDate.getUTCMonth() + 1).toString().padStart(2, '0');
          const year = istDate.getUTCFullYear();
          return `${day}/${month}/${year}`;
        } catch (error) {
          return dateString;
        }
      };
      return `${formatDateOnly(customDateRange.startDate)} to ${formatDateOnly(customDateRange.endDate)}`;
    }
    switch(timePeriod) {
      case '60days': return 'Last 60 Days';
      case '90days': return 'Last 90 Days';
      case '365days': return 'Last 365 Days';
      case 'all': return 'All Time';
      default: return 'Last 7 Days';
    }
  };

  const uniqueCandidates = data.reduce((acc, item) => {
    const key = item.profile_id || item.candidate_name;
    if (!key) return acc;
    
    if (!acc[key] || new Date(item.created_at) > new Date(acc[key].created_at)) {
      acc[key] = item;
    }
    return acc;
  }, {});

  const uniqueCandidatesList = Object.values(uniqueCandidates);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-indigo-800">Location Details: {location}</h2>
            <p className="text-gray-600">
              Showing {uniqueCandidatesList.length} unique candidates ({getPeriodDisplayName()})
              {departmentFilter !== "all" && ` • Department: ${departmentFilter}`}
              {!isAdmin && ` • Your activities only`}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {uniqueCandidatesList.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No Data Found</h3>
              <p className="text-gray-500">
                No activity data found for {location} location in the selected time period.
                {!isAdmin && " You haven't logged any calls for this location."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">User ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">User Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Department</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Candidate Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Last Call</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                   </tr>
                </thead>
                <tbody>
                  {uniqueCandidatesList.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono">{item.employee_id}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{item.user_name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDepartmentColor(item.department)}`}>
                          {item.department}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{item.candidate_name}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {item.company_name || "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {formatDateIST(item.created_at) || "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            handleViewContact(item);
                            onClose();
                          }}
                          className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div className="mt-4 text-sm text-gray-600">
                Showing {uniqueCandidatesList.length} unique candidates for {location} location
                {!isAdmin && " (your activities only)"}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Click on "View Details" to see individual activity logs
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
