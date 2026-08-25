import express from "express"
import { connectDB } from "../db.js"
import { requireAuth } from "../middleware/auth.js"

const router = express.Router()

// Add this at the top, right after router initialization
router.get("/test-routes", (req, res) => {
  const routes = router.stack
    .filter(r => r.route)
    .map(r => ({
      path: r.route.path,
      methods: Object.keys(r.route.methods)
    }));
  res.json({
    success: true,
    routes: routes,
    total: routes.length
  });
});
// GET: Updated Candidates (support per-user filter via user_id or userId)
router.get("/updated-candidates", requireAuth, async (req, res) => {
  try {
    // Debug: log incoming query parameters for per-user filtering
    console.log("[DEBUG] /updated-candidates query:", req.query);
    const { startDate, endDate, user_id, userId, department } = req.query;
    const userFilterId = user_id || userId;
    if (!req.user.is_admin) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    const db = await connectDB();
    let query = `
      SELECT 
        a.user_id,
        u.name as user_name,
        u.employee_id,
        u.department,
        u.phone as phone,
        u.email as email,
        a.profile_id,
        p.name as candidate_name,
        p.company_name,
        p.current_location as candidate_location,
        a.status,
        a.note,
        a.updated_at
      FROM activity_logs a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN profiles p ON a.profile_id = p.id
      WHERE a.status = 'updated'
      AND DATE(CONVERT_TZ(a.updated_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;
    const params = [startDate, endDate];
    if (userFilterId) {
      query += ` AND a.user_id = ?`;
      params.push(userFilterId);
    }
    if (department && department !== 'all') {
      query += ` AND a.department = ?`;
      params.push(department);
    }
    // Ensure deterministic ordering of results for pagination/UI
    query += ` ORDER BY a.updated_at DESC`;
    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error fetching updated candidates:", error);
    res.status(500).json({ success: false, message: "Failed to fetch updated candidates", error: error.message });
  }
});

// Helper function to check user access level
const getUserAccessLevel = (req) => {
  const user = req.user;
  let accessLevel = "user";

  if (user.is_admin) {
    accessLevel = "admin";
  } else if (user.department === "Business Development") {
    accessLevel = "bd";
  } else if (user.department === "Recruitment") {
    accessLevel = "recruitment";
  } else if (user.department === "Franchise") {
    accessLevel = "franchise";
  }

  return accessLevel;
};

// Helper to format department for SQL
const getDepartmentFilter = (accessLevel, userDepartment) => {
  switch (accessLevel) {
    case "admin":
      return null;
    case "bd":
      return "BD";
    case "recruitment":
      return "Recruit";
    case "franchise":
      return "Franchise";
    default:
      return userDepartment;
  }
};

// Helper to map department code to full name for users table
const mapDeptCodeToName = (deptCode) => {
  switch (deptCode) {
    case "BD":
      return "Business Development";
    case "Recruit":
      return "Recruitment";
    case "Franchise":
      return "Franchise";
    default:
      return deptCode;
  }
};

// Helper to map department name to code for activity_logs table
const mapDeptNameToCode = (deptName) => {
  switch (deptName) {
    case "Business Development":
      return "BD";
    case "Recruitment":
      return "Recruit";
    case "Franchise":
      return "Franchise";
    default:
      return deptName;
  }
};

// Helper function to get date range based on period - DEBUG VERSION
const getDateRange = (period = "weekly", customStartDate = null, customEndDate = null) => {
  console.log('🔧 getDateRange called with:', { period, customStartDate, customEndDate });
  
  // Format date for display (DD/MM/YYYY)
  const formatDateForDisplay = (date) => {
    if (!date) return "N/A";
    if (typeof date === 'string') {
      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = date.split('-');
        return `${day}/${month}/${year}`;
      }
      return date;
    }
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateForDB = (date) => {
    if (!date) return null;
    if (typeof date === 'string') {
      // Ensure the string is in YYYY-MM-DD format
      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return date;
      }
      // Try to parse and reformat
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split("T")[0];
      }
      return date;
    }
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  // If custom dates are provided
  if (customStartDate && customEndDate) {
    const startStr = formatDateForDB(customStartDate);
    const endStr = formatDateForDB(customEndDate);
    const result = {
      startDateDisplay: formatDateForDisplay(customStartDate),
      endDateDisplay: formatDateForDisplay(customEndDate),
      startDateISO: startStr,
      endDateISO: endStr,
      startDate: startStr,
      endDate: endStr,
    };
    console.log('📅 Using custom date range:', result);
    return result;
  }
  
  // Get current date
  const now = new Date();
  const endDateUTC = new Date(now);
  endDateUTC.setUTCHours(23, 59, 59, 999);
  let startDateUTC = new Date(endDateUTC);

  // Calculate start date based on period
  switch (period?.toLowerCase() || "weekly") {
    case "60days":
      startDateUTC.setUTCDate(endDateUTC.getUTCDate() - 60);
      break;
    case "90days":
      startDateUTC.setUTCDate(endDateUTC.getUTCDate() - 90);
      break;
    case "365days":
      startDateUTC.setUTCFullYear(endDateUTC.getUTCFullYear() - 1);
      break;
    case "all":
      startDateUTC = new Date('2020-01-01');
      break;
    case "monthly":
      startDateUTC.setUTCDate(endDateUTC.getUTCDate() - 30);
      break;
    case "quarterly":
      startDateUTC.setUTCMonth(endDateUTC.getUTCMonth() - 3);
      break;
    case "yearly":
      startDateUTC.setUTCFullYear(endDateUTC.getUTCFullYear() - 1);
      break;
    case "weekly":
    case "7days":
    default:
      startDateUTC.setUTCDate(endDateUTC.getUTCDate() - 7);
      break;
  }

  startDateUTC.setUTCHours(0, 0, 0, 0);

  const result = {
    startDateDisplay: formatDateForDisplay(startDateUTC),
    endDateDisplay: formatDateForDisplay(endDateUTC),
    startDateISO: formatDateForDB(startDateUTC),
    endDateISO: formatDateForDB(endDateUTC),
    startDate: formatDateForDB(startDateUTC),
    endDate: formatDateForDB(endDateUTC),
  };
  
  console.log('📅 Calculated date range:', result);
  return result;
};

// ===========================================
// GET: Login Statistics - SIMPLIFIED VERSION
// ===========================================
  router.get("/login-stats", requireAuth, async (req, res) => {
  try {
    const { department = "all", period = "daily", startDate, endDate } = req.query;
    
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const db = await connectDB();
    const dateRange = getDateRange(period, startDate, endDate);

    // Get total logins count for the period
    let totalQuery = `
      SELECT COUNT(*) as total_logins
      FROM login_logs ll
      JOIN users u ON ll.user_id = u.id
      WHERE DATE(CONVERT_TZ(ll.login_time, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;

    let totalParams = [dateRange.startDateISO, dateRange.endDateISO];

    if (department && department !== "all") {
      totalQuery += ` AND u.department = ?`;
      totalParams.push(mapDeptCodeToName(department));
    }

    const [totalResult] = await db.execute(totalQuery, totalParams);
    const totalLogins = totalResult[0]?.total_logins || 0;

    // Additional metrics
    // Total logins all-time (optionally filtered by department)
    let allTimeQuery = `SELECT COUNT(*) as total_logins_all_time FROM login_logs ll JOIN users u ON ll.user_id = u.id`;
    let allTimeParams = [];
    if (department && department !== "all") {
      allTimeQuery += ` WHERE u.department = ?`;
      allTimeParams.push(mapDeptCodeToName(department));
    }
    const [allTimeResult] = await db.execute(allTimeQuery, allTimeParams);
    const totalLoginsAllTime = allTimeResult?.[0]?.total_logins_all_time || 0;

    // Total logins today (IST)
    let todayQuery = `SELECT COUNT(*) as total_logins_today FROM login_logs ll JOIN users u ON ll.user_id = u.id WHERE DATE(CONVERT_TZ(ll.login_time, '+00:00', '+05:30')) = CURDATE()`;
    let todayParams = [];
    if (department && department !== "all") {
      todayQuery += ` AND u.department = ?`;
      todayParams.push(mapDeptCodeToName(department));
    }
    const [todayResult] = await db.execute(todayQuery, todayParams);
    const totalLoginsToday = todayResult?.[0]?.total_logins_today || 0;

    // Avg daily logins for the period
    // days in range (inclusive)
    const sDate = dateRange.startDateISO ? new Date(dateRange.startDateISO) : new Date();
    const eDate = dateRange.endDateISO ? new Date(dateRange.endDateISO) : new Date();
    const diffMs = eDate - sDate;
    const daysInRange = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
    const avgDailyLogins = Math.max(0, Math.round(totalLogins / daysInRange));

    // Get user-wise login data
    let userQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.employee_id,
        u.department,
        COUNT(ll.id) as login_count
      FROM users u
      LEFT JOIN login_logs ll ON u.id = ll.user_id
        AND DATE(CONVERT_TZ(ll.login_time, '+00:00', '+05:30')) BETWEEN ? AND ?
      WHERE u.is_approved = 1
    `;

    let userParams = [dateRange.startDateISO, dateRange.endDateISO];

    if (department && department !== "all") {
      userQuery += ` AND u.department = ?`;
      userParams.push(mapDeptCodeToName(department));
    }

    userQuery += `
      GROUP BY u.id
      ORDER BY login_count DESC, u.name ASC
    `;

    const [userData] = await db.execute(userQuery, userParams);

    res.json({
      success: true,
      data: {
        total_logins: totalLogins,
        total_logins_today: totalLoginsToday,
        total_logins_all_time: totalLoginsAllTime,
        avg_daily_logins: avgDailyLogins,
        users: userData.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          employee_id: user.employee_id,
          department: user.department,
          login_count: parseInt(user.login_count) || 0
        })),
        period: period,
        dateRange: {
          startDate: dateRange.startDateDisplay,
          endDate: dateRange.endDateDisplay
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching login stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch login statistics",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// GET: Today’s logins (Who Logged In Today)
router.get("/login-today", requireAuth, async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    const { department = "all" } = req.query;
    const db = await connectDB();
    let query = `SELECT u.id, u.name as user_name, u.employee_id, u.department, COUNT(*) as login_count_today, MAX(ll.login_time) as last_login
      FROM login_logs ll
      JOIN users u ON ll.user_id = u.id
      WHERE DATE(CONVERT_TZ(ll.login_time, '+00:00', '+05:30')) = CURDATE()`;
    const params = [];
    if (department && department !== 'all') {
      query += ` AND u.department = ?`;
      params.push(mapDeptCodeToName(department));
    }
    query += ` GROUP BY u.id, u.name, u.employee_id, u.department ORDER BY login_count_today DESC`;
    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    console.error("❌ Error fetching login today:", error);
    res.status(500).json({ success: false, message: "Failed to fetch today's logins", error: error.message });
  }
});

// ===========================================
// GET: Status Details - OPTIMIZED VERSION
// ===========================================
router.get("/status-details", requireAuth, async (req, res) => {
  try {
    const { status, department = "all", startDate, endDate } = req.query;
    
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status parameter is required",
      });
    }

    const db = await connectDB();
    const period = req.query.period || "weekly";
    const dateRange = getDateRange(period, startDate, endDate);

    // First, get the distinct activities with their latest info
    let mainQuery = `
      SELECT 
        a.user_id,
        u.name as user_name,
        u.employee_id,
        u.department,
        a.profile_id,
        p.name as candidate_name,
        p.company_name,
        p.current_location as candidate_location,
        p.phone,
        p.email,
        p.total_experience,
        a.status,
        MAX(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) as last_activity
      FROM activity_logs a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN profiles p ON a.profile_id = p.id
      WHERE a.status = ?
        AND DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;

    const mainParams = [
      status,
      dateRange.startDateISO, 
      dateRange.endDateISO
    ];

    if (department && department !== "all") {
      mainQuery += ` AND a.department = ?`;
      mainParams.push(department);
    }

    mainQuery += `
      GROUP BY a.user_id, a.profile_id, u.name, u.employee_id, u.department, 
               p.name, p.company_name, p.current_location, p.phone, p.email, 
               p.total_experience, a.status
      ORDER BY u.department, u.name, candidate_name
    `;

    const [mainResults] = await db.execute(mainQuery, mainParams);
    // Safety guard: prevent hanging UI by limiting number of returned rows
    if (Array.isArray(mainResults) && mainResults.length > 700) {
      return res.status(400).json({
        success: false,
        message: "Too many results. Narrow the date range to fetch status details.",
      });
    }

    if (mainResults.length === 0) {
      return res.json({
        success: true,
        data: [],
        status: status,
        department: department,
        period: period,
        dateRange: dateRange,
        count: 0
      });
    }

    // Get profile IDs and user IDs for aggregation
    const profileUserPairs = mainResults.map(r => `(profile_id = ${r.profile_id || 'NULL'} AND user_id = ${r.user_id})`).join(' OR ');
    
    // Use a single aggregation query instead of per-row subqueries
    let aggQuery = `
      SELECT 
        profile_id,
        user_id,
        COUNT(*) as total_calls,
        COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(duration))), '00:00:00') as total_call_hours
      FROM activity_logs
      WHERE (${profileUserPairs})
        AND DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
      GROUP BY profile_id, user_id
    `;

    const aggParams = [dateRange.startDateISO, dateRange.endDateISO];
    
    let aggResults = [];
    if (mainResults.length > 0) {
      try {
        const [results] = await db.execute(aggQuery, aggParams);
        aggResults = results;
      } catch (aggErr) {
        console.warn("Aggregation query failed, using fallback:", aggErr.message);
        aggResults = [];
      }
    }

    // Create lookup map for aggregated data
    const aggMap = new Map();
    aggResults.forEach(item => {
      const key = `${item.profile_id || 'null'}_${item.user_id}`;
      aggMap.set(key, {
        total_calls: item.total_calls,
        total_call_hours: item.total_call_hours
      });
    });

    // Format the results
    const formattedDetails = mainResults.map(item => {
      const key = `${item.profile_id || 'null'}_${item.user_id}`;
      const agg = aggMap.get(key) || { total_calls: 0, total_call_hours: "00:00:00" };
      
      return {
        user_id: item.user_id,
        user_name: item.user_name,
        employee_id: item.employee_id,
        department: item.department,
        profile_id: item.profile_id,
        candidate_name: item.candidate_name || "Unknown",
        company_name: item.company_name || "N/A",
        candidate_location: item.candidate_location || "N/A",
        phone: item.phone || "N/A",
        email: item.email || "N/A",
        total_experience: item.total_experience || "N/A",
        status: item.status,
        total_calls: agg.total_calls || 0,
        total_call_hours: agg.total_call_hours || "00:00:00",
        last_activity: item.last_activity
      };
    });

    res.json({
      success: true,
      data: formattedDetails,
      status: status,
      department: department,
      period: period,
      dateRange: dateRange,
      count: formattedDetails.length
    });

  } catch (error) {
    console.error("❌ Error fetching status details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch status details",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: Click Counts - COMPLETE FIXED VERSION
// ===========================================
router.get("/click-counts", requireAuth, async (req, res) => {
  try {
    const { department = "all", period = "daily", startDate, endDate } = req.query;
    
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const db = await connectDB();
    const dateRange = getDateRange(period, startDate, endDate);

    // Get trend data
    let trendQuery;
    let trendParams;
    
    if (period === 'daily') {
      trendQuery = `
        SELECT 
          DATE_FORMAT(CONVERT_TZ(ANY_VALUE(cv.viewed_at), '+00:00', '+05:30'), '%Y-%m-%d') as date_label,
          COUNT(cv.id) as click_count,
          COUNT(DISTINCT cv.viewer_user_id) as unique_users,
          COUNT(DISTINCT cv.profile_id) as unique_profiles
        FROM contact_views cv
        JOIN users u ON cv.viewer_user_id = u.id
        WHERE DATE(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
      `;
      
      trendParams = [dateRange.startDateISO, dateRange.endDateISO];

      if (department && department !== "all") {
        trendQuery += ` AND u.department = ?`;
        trendParams.push(mapDeptCodeToName(department));
      }

      trendQuery += `
        GROUP BY DATE_FORMAT(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30'), '%Y-%m-%d')
        ORDER BY DATE_FORMAT(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30'), '%Y-%m-%d') ASC
      `;
    } 
    else if (period === 'weekly') {
      trendQuery = `
        SELECT 
          CONCAT(YEAR(CONVERT_TZ(ANY_VALUE(cv.viewed_at), '+00:00', '+05:30')), '-W', 
                 LPAD(WEEK(CONVERT_TZ(ANY_VALUE(cv.viewed_at), '+00:00', '+05:30'), 3), 2, '0')) as date_label,
          COUNT(cv.id) as click_count,
          COUNT(DISTINCT cv.viewer_user_id) as unique_users,
          COUNT(DISTINCT cv.profile_id) as unique_profiles
        FROM contact_views cv
        JOIN users u ON cv.viewer_user_id = u.id
        WHERE DATE(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
      `;
      
      trendParams = [dateRange.startDateISO, dateRange.endDateISO];

      if (department && department !== "all") {
        trendQuery += ` AND u.department = ?`;
        trendParams.push(mapDeptCodeToName(department));
      }

      trendQuery += `
        GROUP BY CONCAT(YEAR(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')), '-W', 
                 LPAD(WEEK(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30'), 3), 2, '0'))
        ORDER BY CONCAT(YEAR(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')), '-W', 
                 LPAD(WEEK(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30'), 3), 2, '0')) ASC
      `;
    }
    else if (period === 'monthly') {
      trendQuery = `
        SELECT 
          DATE_FORMAT(CONVERT_TZ(ANY_VALUE(cv.viewed_at), '+00:00', '+05:30'), '%Y-%m') as date_label,
          COUNT(cv.id) as click_count,
          COUNT(DISTINCT cv.viewer_user_id) as unique_users,
          COUNT(DISTINCT cv.profile_id) as unique_profiles
        FROM contact_views cv
        JOIN users u ON cv.viewer_user_id = u.id
        WHERE DATE(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
      `;
      
      trendParams = [dateRange.startDateISO, dateRange.endDateISO];

      if (department && department !== "all") {
        trendQuery += ` AND u.department = ?`;
        trendParams.push(mapDeptCodeToName(department));
      }

      trendQuery += `
        GROUP BY DATE_FORMAT(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30'), '%Y-%m')
        ORDER BY DATE_FORMAT(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30'), '%Y-%m') ASC
      `;
    }
    else if (period === 'quarterly') {
      trendQuery = `
        SELECT 
          CONCAT(YEAR(CONVERT_TZ(ANY_VALUE(cv.viewed_at), '+00:00', '+05:30')), '-Q', 
                 QUARTER(CONVERT_TZ(ANY_VALUE(cv.viewed_at), '+00:00', '+05:30'))) as date_label,
          COUNT(cv.id) as click_count,
          COUNT(DISTINCT cv.viewer_user_id) as unique_users,
          COUNT(DISTINCT cv.profile_id) as unique_profiles
        FROM contact_views cv
        JOIN users u ON cv.viewer_user_id = u.id
        WHERE DATE(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
      `;
      
      trendParams = [dateRange.startDateISO, dateRange.endDateISO];

      if (department && department !== "all") {
        trendQuery += ` AND u.department = ?`;
        trendParams.push(mapDeptCodeToName(department));
      }

      trendQuery += `
        GROUP BY CONCAT(YEAR(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')), '-Q', 
                 QUARTER(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')))
        ORDER BY CONCAT(YEAR(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')), '-Q', 
                 QUARTER(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30'))) ASC
      `;
    }
    else if (period === 'yearly') {
      trendQuery = `
        SELECT 
          YEAR(CONVERT_TZ(ANY_VALUE(cv.viewed_at), '+00:00', '+05:30')) as date_label,
          COUNT(cv.id) as click_count,
          COUNT(DISTINCT cv.viewer_user_id) as unique_users,
          COUNT(DISTINCT cv.profile_id) as unique_profiles
        FROM contact_views cv
        JOIN users u ON cv.viewer_user_id = u.id
        WHERE DATE(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
      `;
      
      trendParams = [dateRange.startDateISO, dateRange.endDateISO];

      if (department && department !== "all") {
        trendQuery += ` AND u.department = ?`;
        trendParams.push(mapDeptCodeToName(department));
      }

      trendQuery += `
        GROUP BY YEAR(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30'))
        ORDER BY YEAR(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) ASC
      `;
    }
    else {
      // Default to daily
      trendQuery = `
        SELECT 
          DATE_FORMAT(CONVERT_TZ(ANY_VALUE(cv.viewed_at), '+00:00', '+05:30'), '%Y-%m-%d') as date_label,
          COUNT(cv.id) as click_count,
          COUNT(DISTINCT cv.viewer_user_id) as unique_users,
          COUNT(DISTINCT cv.profile_id) as unique_profiles
        FROM contact_views cv
        JOIN users u ON cv.viewer_user_id = u.id
        WHERE DATE(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
      `;
      
      trendParams = [dateRange.startDateISO, dateRange.endDateISO];

      if (department && department !== "all") {
        trendQuery += ` AND u.department = ?`;
        trendParams.push(mapDeptCodeToName(department));
      }

      trendQuery += `
        GROUP BY DATE_FORMAT(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30'), '%Y-%m-%d')
        ORDER BY DATE_FORMAT(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30'), '%Y-%m-%d') ASC
      `;
    }

    console.log('📊 Trend Query:', trendQuery);
    console.log('📊 Trend Params:', trendParams);

    const [trendData] = await db.execute(trendQuery, trendParams);

    // Get summary statistics
    let summaryQuery = `
      SELECT 
        COALESCE(SUM(u.click_count), 0) as total_clicks_all_time,
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE WHEN cv.id IS NOT NULL THEN u.id END) as active_users,
        COALESCE((
          SELECT COUNT(*) 
          FROM contact_views cv2 
          WHERE DATE(CONVERT_TZ(cv2.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
        ), 0) as clicks_this_period,
        COALESCE((
          SELECT COUNT(DISTINCT cv2.viewer_user_id) 
          FROM contact_views cv2 
          WHERE DATE(CONVERT_TZ(cv2.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
        ), 0) as active_users_period,
        COALESCE((
          SELECT COUNT(DISTINCT cv2.profile_id) 
          FROM contact_views cv2 
          WHERE DATE(CONVERT_TZ(cv2.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
        ), 0) as unique_profiles_period
      FROM users u
      LEFT JOIN contact_views cv ON u.id = cv.viewer_user_id
        AND DATE(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
      WHERE u.is_approved = 1
    `;

    let summaryParams = [
      dateRange.startDateISO, dateRange.endDateISO,
      dateRange.startDateISO, dateRange.endDateISO,
      dateRange.startDateISO, dateRange.endDateISO,
      dateRange.startDateISO, dateRange.endDateISO
    ];

    if (department && department !== "all") {
      summaryQuery += ` AND u.department = ?`;
      summaryParams.push(mapDeptCodeToName(department));
    }

    const [summary] = await db.execute(summaryQuery, summaryParams);

    // Get user-wise click data
    let userQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.employee_id,
        u.department,
        COALESCE(u.click_count, 0) as total_clicks,
        COALESCE((
          SELECT COUNT(*) 
          FROM contact_views cv2 
          WHERE cv2.viewer_user_id = u.id
          AND DATE(CONVERT_TZ(cv2.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
        ), 0) as period_clicks,
        COALESCE((
          SELECT COUNT(DISTINCT cv2.profile_id) 
          FROM contact_views cv2 
          WHERE cv2.viewer_user_id = u.id
          AND DATE(CONVERT_TZ(cv2.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
        ), 0) as unique_profiles_period,
        COALESCE((
          SELECT MAX(CONVERT_TZ(viewed_at, '+00:00', '+05:30'))
          FROM contact_views 
          WHERE viewer_user_id = u.id
        ), null) as last_click
      FROM users u
      WHERE u.is_approved = 1
    `;

    let userParams = [
      dateRange.startDateISO, dateRange.endDateISO,
      dateRange.startDateISO, dateRange.endDateISO
    ];

    if (department && department !== "all") {
      userQuery += ` AND u.department = ?`;
      userParams.push(mapDeptCodeToName(department));
    }

    userQuery += ` ORDER BY u.employee_id ASC`;

    const [userData] = await db.execute(userQuery, userParams);

    // Calculate trend direction
    let trendDirection = 0;
    if (trendData.length >= 2) {
      const firstValue = trendData[0]?.click_count || 0;
      const lastValue = trendData[trendData.length - 1]?.click_count || 0;
      trendDirection = lastValue - firstValue;
    }

    // Calculate average clicks per user
    const avgClicksPerUser = summary[0]?.active_users_period > 0 
      ? (summary[0]?.clicks_this_period / summary[0]?.active_users_period).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        trend: trendData.map(item => ({
          label: item.date_label,
          value: parseInt(item.click_count) || 0,
          unique_users: parseInt(item.unique_users) || 0,
          unique_profiles: parseInt(item.unique_profiles) || 0
        })),
        summary: {
          total_clicks_all_time: parseInt(summary[0]?.total_clicks_all_time) || 0,
          clicks_this_period: parseInt(summary[0]?.clicks_this_period) || 0,
          total_users: parseInt(summary[0]?.total_users) || 0,
          active_users: parseInt(summary[0]?.active_users) || 0,
          active_users_period: parseInt(summary[0]?.active_users_period) || 0,
          unique_profiles_period: parseInt(summary[0]?.unique_profiles_period) || 0,
          avg_clicks_per_user: parseFloat(avgClicksPerUser),
          trend_direction: trendDirection
        },
        users: userData.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          employee_id: user.employee_id,
          department: user.department,
          click_count: parseInt(user.total_clicks) || 0,
          click_count_period: parseInt(user.period_clicks) || 0,
          unique_profiles_period: parseInt(user.unique_profiles_period) || 0,
          last_click: user.last_click ? new Date(user.last_click).toLocaleString('en-IN', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true 
          }) : 'Never'
        })),
        period: period,
        dateRange: {
          startDate: dateRange.startDateDisplay,
          endDate: dateRange.endDateDisplay
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching click counts:", error);
    console.error("❌ SQL Error Details:", {
      message: error.message,
      code: error.code,
      sql: error.sql,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({
      success: false,
      message: "Failed to fetch click counts",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: Click Counts Trend Data - NEW ENDPOINT
// ===========================================
router.get("/click-trends", requireAuth, async (req, res) => {
  try {
    const { department = "all", period = "daily", startDate, endDate } = req.query;
    
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const db = await connectDB();
    const dateRange = getDateRange(period, startDate, endDate);

    let dateFormat, groupBy;
    
    // Set date format based on period
    switch(period) {
      case 'daily':
        dateFormat = '%Y-%m-%d';
        groupBy = 'DATE(viewed_at)';
        break;
      case 'weekly':
        dateFormat = '%Y-%u';
        groupBy = 'YEARWEEK(viewed_at, 3)';
        break;
      case 'monthly':
        dateFormat = '%Y-%m';
        groupBy = 'DATE_FORMAT(viewed_at, "%Y-%m")';
        break;
      case 'quarterly':
        dateFormat = '%Y-%q';
        groupBy = 'CONCAT(YEAR(viewed_at), "-Q", QUARTER(viewed_at))';
        break;
      case 'yearly':
        dateFormat = '%Y';
        groupBy = 'YEAR(viewed_at)';
        break;
      default:
        dateFormat = '%Y-%m-%d';
        groupBy = 'DATE(viewed_at)';
    }

    let query = `
      SELECT 
        DATE_FORMAT(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30'), ?) as date_label,
        COUNT(cv.id) as click_count,
        COUNT(DISTINCT cv.viewer_user_id) as unique_users
      FROM contact_views cv
      JOIN users u ON cv.viewer_user_id = u.id
      WHERE DATE(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;

    const params = [dateFormat, dateRange.startDateISO, dateRange.endDateISO];

    if (department && department !== "all") {
      const deptName = mapDeptCodeToName(department);
      query += ` AND u.department = ?`;
      params.push(deptName);
    }

    query += `
      GROUP BY ${groupBy}
      ORDER BY MIN(cv.viewed_at) ASC
    `;

    const [trendData] = await db.execute(query, params);

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(u.click_count), 0) as total_clicks_all_time,
        COUNT(DISTINCT cv.viewer_user_id) as unique_viewers,
        COUNT(DISTINCT cv.profile_id) as unique_profiles_viewed,
        COALESCE(SUM(CASE 
          WHEN DATE(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ? 
          THEN 1 ELSE 0 
        END), 0) as total_clicks_period
      FROM users u
      LEFT JOIN contact_views cv ON u.id = cv.viewer_user_id
      WHERE u.is_approved = 1
    `;

    const summaryParams = [dateRange.startDateISO, dateRange.endDateISO];

    if (department && department !== "all") {
      summaryQuery += ` AND u.department = ?`;
      summaryParams.push(mapDeptCodeToName(department));
    }

    const [summary] = await db.execute(summaryQuery, summaryParams);

    // Get user-wise click data
    const userQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.employee_id,
        u.department,
        COALESCE(u.click_count, 0) as total_clicks,
        COALESCE((
          SELECT COUNT(*) 
          FROM contact_views cv2 
          WHERE cv2.viewer_user_id = u.id
          AND DATE(CONVERT_TZ(cv2.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
        ), 0) as period_clicks,
        COALESCE((
          SELECT COUNT(DISTINCT profile_id) 
          FROM contact_views cv2 
          WHERE cv2.viewer_user_id = u.id
          AND DATE(CONVERT_TZ(cv2.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
        ), 0) as unique_profiles_period
      FROM users u
      WHERE u.is_approved = 1
    `;

    const userParams = [
      dateRange.startDateISO, dateRange.endDateISO,
      dateRange.startDateISO, dateRange.endDateISO
    ];

    if (department && department !== "all") {
      userQuery += ` AND u.department = ?`;
      userParams.push(mapDeptCodeToName(department));
    }

    userQuery += ` ORDER BY u.employee_id ASC`;

    const [userData] = await db.execute(userQuery, userParams);

    res.json({
      success: true,
      data: {
        trend: trendData,
        summary: summary[0] || {
          total_clicks_all_time: 0,
          unique_viewers: 0,
          unique_profiles_viewed: 0,
          total_clicks_period: 0
        },
        users: userData,
        period: period,
        dateRange: {
          startDate: dateRange.startDateDisplay,
          endDate: dateRange.endDateDisplay
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching click trends:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch click trends",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: Dashboard - UPDATED with enhanced click count aggregation
// ===========================================
router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const accessLevel = getUserAccessLevel(req);
    const { department, startDate, endDate, user_id } = req.query;
    
    const db = await connectDB();
    const period = req.query.period || "7days";
    const dateRange = getDateRange(period, startDate, endDate);

    // 1. Overall Statistics - UPDATED to include total click counts
    let overallStatsQuery = `
      SELECT 
        COUNT(DISTINCT u.id) as total_users,
        COALESCE(COUNT(DISTINCT a.id), 0) as total_activities,
        COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(a.duration))), '00:00:00') as total_call_hours,
        COALESCE(SUM(CASE WHEN a.status = 'closed' THEN 1 ELSE 0 END), 0) as closed_deals,
        COALESCE(SUM(CASE WHEN a.status = 'in-progress' THEN 1 ELSE 0 END), 0) as in_progress,
        COALESCE(SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled,
        COALESCE(SUM(CASE WHEN a.status = 'follow-up' THEN 1 ELSE 0 END), 0) as follow_ups,
        COALESCE(SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
        COALESCE(SUM(u.click_count), 0) as total_click_counts,
        ( 
          SELECT COUNT(*) 
          FROM contact_views cv 
          WHERE DATE(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
        ) as period_click_counts,
        (
          SELECT COUNT(DISTINCT ll.user_id)
          FROM login_logs ll
          WHERE DATE(CONVERT_TZ(ll.login_time, '+00:00', '+05:30')) = CURDATE()
        ) as unique_logins_today,
        (
          SELECT COUNT(*)
          FROM login_logs ll
          WHERE DATE(CONVERT_TZ(ll.login_time, '+00:00', '+05:30')) = CURDATE()
        ) as total_logins_today,
        (
          SELECT COUNT(DISTINCT ll.user_id)
          FROM login_logs ll
          WHERE DATE(CONVERT_TZ(ll.login_time, '+00:00', '+05:30')) BETWEEN ? AND ?
        ) as unique_logins_period,
        (
          SELECT COUNT(*)
          FROM login_logs ll
          WHERE DATE(CONVERT_TZ(ll.login_time, '+00:00', '+05:30')) BETWEEN ? AND ?
        ) as total_logins_period
      FROM users u
      LEFT JOIN activity_logs a ON u.id = a.user_id
        AND DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
      WHERE u.is_approved = 1
    `;

    let overallStatsParams = [
      dateRange.startDateISO, dateRange.endDateISO,  // for period_click_counts
      dateRange.startDateISO, dateRange.endDateISO,  // for unique_logins_period
      dateRange.startDateISO, dateRange.endDateISO,  // for total_logins_period
      dateRange.startDateISO, dateRange.endDateISO   // for activity_logs join
    ];

    if (department && department !== "all" && accessLevel === "admin") {
      const deptName = mapDeptCodeToName(department);
      const deptCode = mapDeptNameToCode(deptName);
      overallStatsQuery += ` AND (u.department = ? OR a.department = ?)`;
      overallStatsParams.push(deptName, deptCode);
    } else if (accessLevel !== "admin") {
      const deptCode = getDepartmentFilter(accessLevel, req.user.department);
      const deptName = mapDeptCodeToName(deptCode);
      overallStatsQuery += ` AND (u.department = ? OR a.department = ?)`;
      overallStatsParams.push(deptName, deptCode);
    }
    
    if (user_id) {
      overallStatsQuery += ` AND u.id = ?`;
      overallStatsParams.push(user_id);
    } else if (accessLevel !== "admin") {
      overallStatsQuery += ` AND u.id = ?`;
      overallStatsParams.push(req.user.id);
    }

    const [overallStats] = await db.execute(overallStatsQuery, overallStatsParams);

    // 2. User Performance Ranking - UPDATED to ensure click counts are included
    let userPerformanceQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.employee_id,
        u.department,
        COALESCE(u.click_count, 0) as click_count,
        COALESCE(
          (SELECT COUNT(DISTINCT cv.profile_id) FROM contact_views cv 
           WHERE cv.viewer_user_id = u.id 
           AND DATE(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?),
          0
        ) as unique_profile_views,
        COALESCE(
          (SELECT COUNT(*) FROM contact_views cv 
           WHERE cv.viewer_user_id = u.id 
           AND DATE(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?),
          0
        ) as click_count_period,
        COALESCE(COUNT(DISTINCT a.id), 0) as activity_count,
        COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(a.duration))), '00:00:00') as total_hours,
        COALESCE(SUM(CASE WHEN a.status = 'closed' THEN 1 ELSE 0 END), 0) as closed_count,
        COALESCE(u.login_attempts, 0) as login_attempts,
        DATE_FORMAT(CONVERT_TZ(u.last_activity, '+00:00', '+05:30'), '%d/%m/%Y %h:%i:%s %p') as last_activity,
        COALESCE(u.total_call_hours, '00:00:00') as user_total_hours,
        COALESCE(u.call_count, 0) as user_call_count,
        (
          SELECT COUNT(*)
          FROM login_logs ll
          WHERE ll.user_id = u.id
          AND DATE(CONVERT_TZ(ll.login_time, '+00:00', '+05:30')) = CURDATE()
        ) as logins_today,
        (
          SELECT COUNT(*)
          FROM login_logs ll
          WHERE ll.user_id = u.id
          AND DATE(CONVERT_TZ(ll.login_time, '+00:00', '+05:30')) BETWEEN ? AND ?
        ) as logins_period
      FROM users u
      LEFT JOIN activity_logs a ON u.id = a.user_id
        AND DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
      WHERE u.is_approved = 1
    `;

    let userPerformanceParams = [
      dateRange.startDateISO, dateRange.endDateISO,  // for unique_profile_views
      dateRange.startDateISO, dateRange.endDateISO,  // for click_count_period
      dateRange.startDateISO, dateRange.endDateISO,  // for logins_period
      dateRange.startDateISO, dateRange.endDateISO   // for activity_logs join
    ];

    // NON-ADMIN USERS: ALWAYS show only their own data
    if (accessLevel !== "admin") {
      userPerformanceQuery += ` AND u.id = ?`;
      userPerformanceParams.push(req.user.id);
    } else {
      // ADMIN USERS: can filter by department or specific user
      if (department && department !== "all") {
        const deptName = mapDeptCodeToName(department);
        userPerformanceQuery += ` AND u.department = ?`;
        userPerformanceParams.push(deptName);
      }
      
      if (user_id) {
        userPerformanceQuery += ` AND u.id = ?`;
        userPerformanceParams.push(user_id);
      }
    }

    userPerformanceQuery += `
      GROUP BY u.id
      ORDER BY u.employee_id ASC
    `;

    // Only limit for non-admin users or when viewing a specific user
    if (accessLevel !== "admin" || user_id) {
      userPerformanceQuery += ` LIMIT 20`;
    }

    const [userPerformance] = await db.execute(userPerformanceQuery, userPerformanceParams);

    // 3. Activity Trends
    let trendsQuery = `
      SELECT 
        DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) as date,
        COUNT(a.id) as activity_count,
        COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(a.duration))), '00:00:00') as total_duration,
        SUM(CASE WHEN a.status = 'closed' THEN 1 ELSE 0 END) as closed_count
      FROM activity_logs a
      WHERE DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;

    let trendsParams = [dateRange.startDateISO, dateRange.endDateISO];

    if (department && department !== "all" && accessLevel === "admin") {
      trendsQuery += ` AND a.department = ?`;
      trendsParams.push(department);
    } else if (accessLevel !== "admin") {
      const deptCode = getDepartmentFilter(accessLevel, req.user.department);
      trendsQuery += ` AND a.department = ?`;
      trendsParams.push(deptCode);
    }
    
    if (user_id) {
      trendsQuery += ` AND a.user_id = ?`;
      trendsParams.push(user_id);
    } else if (accessLevel !== "admin") {
      trendsQuery += ` AND a.user_id = ?`;
      trendsParams.push(req.user.id);
    }

    trendsQuery += `
      GROUP BY DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30'))
      ORDER BY date ASC
    `;

    const [activityTrends] = await db.execute(trendsQuery, trendsParams);

    // 4. Location-based statistics
    let locationQuery = `
      SELECT 
        candidate_location as location,
        COUNT(*) as callCount,
        ROUND(SUM(TIME_TO_SEC(duration)) / 3600, 1) as callHours,
        COUNT(DISTINCT user_id) as activeUsers,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count
      FROM activity_logs
      WHERE candidate_location IS NOT NULL 
        AND candidate_location != ''
        AND candidate_location NOT IN ('N/A', 'n/a', 'NA', 'na', 'null', 'NULL', 'undefined', 'none', '-')
        AND TRIM(candidate_location) != ''
        AND LENGTH(TRIM(candidate_location)) > 0
        AND LOWER(candidate_location) NOT LIKE '%n/a%'
        AND LOWER(candidate_location) NOT LIKE '%none%'
        AND LOWER(candidate_location) NOT LIKE '%null%'
        AND DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;

    let locationParams = [dateRange.startDateISO, dateRange.endDateISO];

    if (department && department !== "all" && accessLevel === "admin") {
      locationQuery += ` AND department = ?`;
      locationParams.push(department);
    } else if (accessLevel !== "admin") {
      const deptCode = getDepartmentFilter(accessLevel, req.user.department);
      locationQuery += ` AND department = ?`;
      locationParams.push(deptCode);
    }
    
    if (user_id) {
      locationQuery += ` AND user_id = ?`;
      locationParams.push(user_id);
    } else if (accessLevel !== "admin") {
      locationQuery += ` AND user_id = ?`;
      locationParams.push(req.user.id);
    }

    locationQuery += `
      GROUP BY candidate_location
      HAVING location IS NOT NULL AND TRIM(location) != '' AND callCount > 0
      ORDER BY callCount DESC
      LIMIT 10
    `;

    const [locationStats] = await db.execute(locationQuery, locationParams);

    // 5. Status distribution
    let statusQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(duration))), '00:00:00') as total_time
      FROM activity_logs
      WHERE DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;

    let statusParams = [dateRange.startDateISO, dateRange.endDateISO];

    if (department && department !== "all" && accessLevel === "admin") {
      statusQuery += ` AND department = ?`;
      statusParams.push(department);
    } else if (accessLevel !== "admin") {
      const deptCode = getDepartmentFilter(accessLevel, req.user.department);
      statusQuery += ` AND department = ?`;
      statusParams.push(deptCode);
    }
    
    if (user_id) {
      statusQuery += ` AND user_id = ?`;
      statusParams.push(user_id);
    } else if (accessLevel !== "admin") {
      statusQuery += ` AND user_id = ?`;
      statusParams.push(req.user.id);
    }

    statusQuery += `
      GROUP BY status
      ORDER BY count DESC
    `;

    const [statusDistribution] = await db.execute(statusQuery, statusParams);

    const allStatuses = ["in-progress", "cancelled", "closed", "follow-up", "pending", "updated"];
    const statusMap = {};
    statusDistribution.forEach((s) => {
      statusMap[s.status] = s;
    });

    const completeStatusDistribution = allStatuses.map((status) => ({
      status,
      count: statusMap[status]?.count || 0,
      total_time: statusMap[status]?.total_time || "00:00:00",
    }));

    // 6. Recent activities
    let recentQuery = `
      SELECT 
        a.*,
        u.name as user_name,
        u.employee_id,
        u.department as user_department,
        p.id as profile_id,
        COALESCE(p.name, 'Unknown') as profile_name,
        COALESCE(p.company_name, 'Not specified') as company_name,
        COALESCE(p.designation, 'Not specified') as designation,
        COALESCE(p.current_location, a.candidate_location, 'Not specified') as current_location,
        COALESCE(p.phone, 'Not available') as phone,
        COALESCE(p.email, 'Not available') as email,
        COALESCE(p.total_experience, 'Not specified') as total_experience,
        COALESCE(
          DATE_FORMAT(CONVERT_TZ(a.created_at, '+00:00', '+05:30'), '%Y-%m-%d %H:%i:%s'),
          DATE_FORMAT(CONVERT_TZ(a.updated_at, '+00:00', '+05:30'), '%Y-%m-%d %H:%i:%s')
        ) as created_at_ist,
        COALESCE(
          DATE_FORMAT(CONVERT_TZ(a.created_at, '+00:00', '+05:30'), '%d/%m/%Y %h:%i:%s %p'),
          DATE_FORMAT(CONVERT_TZ(a.updated_at, '+00:00', '+05:30'), '%d/%m/%Y %h:%i:%s %p'),
          'Date not available'
        ) as created_at_formatted
      FROM activity_logs a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN profiles p ON a.profile_id = p.id
      WHERE DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;

    let recentParams = [dateRange.startDateISO, dateRange.endDateISO];

    if (department && department !== "all" && accessLevel === "admin") {
      recentQuery += ` AND a.department = ?`;
      recentParams.push(department);
    } else if (accessLevel !== "admin") {
      const deptCode = getDepartmentFilter(accessLevel, req.user.department);
      recentQuery += ` AND a.department = ?`;
      recentParams.push(deptCode);
    }
    
    if (user_id) {
      recentQuery += ` AND a.user_id = ?`;
      recentParams.push(user_id);
    } else if (accessLevel !== "admin") {
      recentQuery += ` AND a.user_id = ?`;
      recentParams.push(req.user.id);
    }

    if (accessLevel === "admin" && !user_id) {
  recentQuery += `
    ORDER BY COALESCE(a.created_at, a.updated_at, NOW()) DESC
    LIMIT 500
  `;
} else {
  // Non-admin or specific user view - load all their activities
  recentQuery += `
    ORDER BY COALESCE(a.created_at, a.updated_at, NOW()) DESC
    LIMIT 500
  `;
}

    const [recentActivities] = await db.execute(recentQuery, recentParams);

    // 7. Department Performance Data (for admin view)
    let departmentPerformance = [];
    if (accessLevel === "admin") {
      const deptQuery = `
        SELECT 
          CASE 
            WHEN a.department = 'BD' OR a.department = 'Business Development' THEN 'BD'
            WHEN a.department = 'Recruit' OR a.department = 'Recruitment' THEN 'Recruit'
            WHEN a.department = 'Franchise' THEN 'Franchise'
            ELSE a.department
          END as department,
          COUNT(DISTINCT a.id) as total_activities,
          COUNT(DISTINCT u.id) as user_count,
          COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(a.duration))), '00:00:00') as total_hours,
          SUM(CASE WHEN a.status = 'closed' THEN 1 ELSE 0 END) as closed_deals
        FROM activity_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
        AND a.department IN ('BD', 'Business Development', 'Recruit', 'Recruitment', 'Franchise')
        GROUP BY 
          CASE 
            WHEN a.department = 'BD' OR a.department = 'Business Development' THEN 'BD'
            WHEN a.department = 'Recruit' OR a.department = 'Recruitment' THEN 'Recruit'
            WHEN a.department = 'Franchise' THEN 'Franchise'
            ELSE a.department
          END
      `;

      const [deptData] = await db.execute(deptQuery, [dateRange.startDateISO, dateRange.endDateISO]);
      departmentPerformance = deptData;
    }
    
    // 8. Department-specific status distribution for admin
    let departmentStatusData = [];
    if (accessLevel === "admin") {
  let deptStatusQuery = `
      SELECT 
        CASE 
          WHEN a.department = 'BD' OR a.department = 'Business Development' THEN 'BD'
          WHEN a.department = 'Recruit' OR a.department = 'Recruitment' THEN 'Recruit'
          WHEN a.department = 'Franchise' THEN 'Franchise'
          ELSE a.department
        END as department,
        a.status,
        COUNT(*) as count,
        COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(a.duration))), '00:00:00') as total_time
      FROM activity_logs a
      WHERE a.department IN ('BD', 'Recruit', 'Franchise')
      AND DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;
  const deptStatusParams = [dateRange.startDateISO, dateRange.endDateISO];
  // Optional user filter to enable per-user status view
  if (typeof user_id !== 'undefined' && user_id) {
    deptStatusQuery += ` AND a.user_id = ?`;
    deptStatusParams.push(user_id);
  }
  deptStatusQuery += `
      GROUP BY department, a.status
      ORDER BY department, count DESC
    `;
  const [deptStatus] = await db.execute(deptStatusQuery, deptStatusParams);
      departmentStatusData = deptStatus;
    }

    res.json({
      success: true,
      accessLevel,
      data: {
        overallStats: overallStats[0] || {
          total_users: 0,
          total_activities: 0,
          total_call_hours: "00:00:00",
          closed_deals: 0,
          in_progress: 0,
          cancelled: 0,
          follow_ups: 0,
          pending: 0,
          total_click_counts: 0,
          period_click_counts: 0,
          unique_logins_today: 0,
          total_logins_today: 0,
          unique_logins_period: 0,
          total_logins_period: 0
        },
        userPerformance: userPerformance.map(user => ({
          ...user,
          click_count: user.click_count || 0,
          unique_profile_views: user.unique_profile_views || user.click_count_period || 0
        })),
        activityTrends,
        locationStats,
        statusDistribution: completeStatusDistribution,
        recentActivities,
        departmentPerformance,
        departmentStatusData,
        dateRange,
        isAdmin: accessLevel === "admin",
      },
    });
  } catch (error) {
    console.error("❌ Error fetching dashboard data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: Location Statistics
// ===========================================
router.get("/location-stats", requireAuth, async (req, res) => {
  try {
    const accessLevel = getUserAccessLevel(req);
    const { department, startDate, endDate, user_id } = req.query;
    
    const db = await connectDB();
    const period = req.query.period || "7days";
    const dateRange = getDateRange(period, startDate, endDate);

    let query = `
  SELECT 
    COALESCE(p.current_location, 'Unknown') as location,
    COUNT(DISTINCT a.id) as callCount,
    ROUND(SUM(TIME_TO_SEC(a.duration)) / 3600, 1) as callHours,
    COUNT(DISTINCT a.user_id) as activeUsers,
    COUNT(DISTINCT a.profile_id) as uniqueCandidates,
    SUM(CASE WHEN a.status = 'closed' THEN 1 ELSE 0 END) as closed_count,
    SUM(CASE WHEN a.status = 'in-progress' THEN 1 ELSE 0 END) as in_progress_count,
    SUM(CASE WHEN a.status = 'follow-up' THEN 1 ELSE 0 END) as follow_up_count,
    SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
    SUM(CASE WHEN a.status = 'updated' THEN 1 ELSE 0 END) as updated_count,
    SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) as pending_count
  FROM activity_logs a
  LEFT JOIN profiles p ON a.profile_id = p.id
  WHERE 1=1
    AND DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
`;

    let params = [dateRange.startDateISO, dateRange.endDateISO];

    // Clean location filter
    query += ` AND COALESCE(p.current_location, '') != ''
      AND COALESCE(p.current_location, '') IS NOT NULL
      AND TRIM(COALESCE(p.current_location, '')) != ''
      AND UPPER(TRIM(COALESCE(p.current_location, ''))) NOT IN ('N/A', 'NA', 'NULL', 'UNDEFINED', '-', '--')`;

    // Apply department filter for admin
    if (department && department !== "all" && department !== "undefined" && accessLevel === "admin") {
      query += ` AND a.department = ?`;
      params.push(department);
    }

    // CRITICAL FIX: For non-admin users, filter by their user_id
    if (user_id) {
      query += ` AND a.user_id = ?`;
      params.push(user_id);
    } else if (accessLevel !== "admin") {
      query += ` AND a.user_id = ?`;
      params.push(req.user.id);
    }

    query += `
      GROUP BY COALESCE(p.current_location, 'Unknown')
      HAVING location != 'Unknown' AND callCount > 0
      ORDER BY callCount DESC
      LIMIT 20
    `;

    const [locationStats] = await db.execute(query, params);

    // Format the response
    const formattedStats = locationStats.map(stat => ({
  location: stat.location,
  callCount: stat.callCount || 0,
  callHours: stat.callHours || 0,
  activeUsers: stat.activeUsers || 0,
  uniqueCandidates: stat.uniqueCandidates || 0,
  closed_count: stat.closed_count || 0,
  in_progress_count: stat.in_progress_count || 0,
  follow_up_count: stat.follow_up_count || 0,
  cancelled_count: stat.cancelled_count || 0,
  updated_count: stat.updated_count || 0,
  pending_count: stat.pending_count || 0,
  isUserData: accessLevel !== "admin" || user_id ? true : false
}));
    res.json({
      success: true,
      data: formattedStats,
      dateRange,
      filteredBy: {
        department: (accessLevel === "admin" && department) || (accessLevel !== "admin" ? req.user.department : "all"),
        user: user_id || (accessLevel !== "admin" ? req.user.id : null),
        period: period,
        isUserData: accessLevel !== "admin" || user_id ? true : false
      }
    });

  } catch (error) {
    console.error("❌ Error fetching location stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch location statistics",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: Location Details
// ===========================================
router.get("/location-details", requireAuth, async (req, res) => {
  try {
    const { location, department = "all", startDate, endDate, user_id } = req.query;
    const accessLevel = getUserAccessLevel(req);
    
    if (!location) {
      return res.status(400).json({
        success: false,
        message: "Location parameter is required",
      });
    }

    const db = await connectDB();
    const period = req.query.period || "7days";
    const dateRange = getDateRange(period, startDate, endDate);

    // Get unique candidates per location (latest activity only)
    let query = `
      SELECT 
        a.id,
        a.user_id,
        a.profile_id,
        a.status,
        a.duration,
        a.note,
        a.candidate_location,
        a.created_at,
        u.name as user_name,
        u.employee_id,
        u.department,
        p.name as candidate_name,
        p.company_name,
        p.current_location,
        DATE_FORMAT(CONVERT_TZ(a.created_at, '+00:00', '+05:30'), '%Y-%m-%d %H:%i:%s') as created_at_ist,
        DATE_FORMAT(CONVERT_TZ(a.created_at, '+00:00', '+05:30'), '%d/%m/%Y %h:%i:%s %p') as created_at_formatted,
        ROW_NUMBER() OVER (PARTITION BY a.profile_id ORDER BY a.created_at DESC) as rn
      FROM activity_logs a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN profiles p ON a.profile_id = p.id
      WHERE p.current_location = ?
        AND DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;

    let params = [location, dateRange.startDateISO, dateRange.endDateISO];

    // Apply department filter for admin
    if (department && department !== "all" && accessLevel === "admin") {
      let deptParam = department;
      if (deptParam === "BD") deptParam = "BD";
      if (deptParam === "Recruit") deptParam = "Recruit";
      if (deptParam === "Franchise") deptParam = "Franchise";
      
      query += ` AND a.department = ?`;
      params.push(deptParam);
    }
    
    // CRITICAL FIX: For non-admin users, filter by their user_id
    if (user_id) {
      query += ` AND a.user_id = ?`;
      params.push(user_id);
    } else if (accessLevel !== "admin") {
      query += ` AND a.user_id = ?`;
      params.push(req.user.id);
    }

    query += ` ORDER BY a.created_at DESC`;

    const [locationData] = await db.execute(query, params);

    // Filter to get only unique candidates (rn = 1)
    const uniqueCandidates = locationData.filter(item => item.rn === 1);

    // Get summary statistics for this location
    let summaryQuery = `
      SELECT 
        COUNT(DISTINCT a.user_id) as active_users,
        COUNT(DISTINCT a.profile_id) as unique_candidates,
        COUNT(a.id) as total_calls,
        ROUND(SUM(TIME_TO_SEC(a.duration)) / 3600, 1) as total_hours
      FROM activity_logs a
      WHERE a.candidate_location = ?
        AND DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;

    let summaryParams = [location, dateRange.startDateISO, dateRange.endDateISO];
    
    if (department && department !== "all" && accessLevel === "admin") {
      summaryQuery += ` AND a.department = ?`;
      summaryParams.push(department);
    }
    
    if (user_id) {
      summaryQuery += ` AND a.user_id = ?`;
      summaryParams.push(user_id);
    } else if (accessLevel !== "admin") {
      summaryQuery += ` AND a.user_id = ?`;
      summaryParams.push(req.user.id);
    }

    const [summary] = await db.execute(summaryQuery, summaryParams);

    const formattedData = uniqueCandidates.map(item => ({
      id: item.id,
      user_id: item.user_id,
      profile_id: item.profile_id,
      employee_id: item.employee_id,
      user_name: item.user_name,
      department: item.department,
      candidate_name: item.candidate_name || "Unknown",
      company_name: item.company_name || "N/A",
      candidate_location: item.current_location || location,
      status: item.status,
      duration: item.duration,
      note: item.note,
      created_at: item.created_at_ist,
      created_at_formatted: item.created_at_formatted
    }));

    res.json({
      success: true,
      data: formattedData,
      location: location,
      summary: {
        active_users: summary[0]?.active_users || 0,
        unique_candidates: summary[0]?.unique_candidates || 0,
        total_calls: summary[0]?.total_calls || 0,
        total_hours: summary[0]?.total_hours || 0
      },
      department_filter: department,
      dateRange: dateRange,
      filtered_by_user: user_id || (accessLevel !== "admin" ? req.user.id : null),
      isUserData: accessLevel !== "admin" || user_id ? true : false
    });

  } catch (error) {
    console.error("❌ Error fetching location details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch location details",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: Viewed Profiles
// ===========================================
router.get("/viewed-profiles/:userId", requireAuth, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    if (isNaN(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }
    
    const { startDate, endDate } = req.query;
    const currentUser = req.user;
    
    console.log('📊 Viewed profiles request:', {
      userId: targetUserId,
      startDate,
      endDate,
      period: req.query.period,
      isAdmin: currentUser.is_admin
    });

    if (!currentUser.is_admin && currentUser.id !== targetUserId) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own viewed profiles",
      });
    }

    const db = await connectDB();
    const period = req.query.period || "7days";
    
    let dateRange;
    try {
      dateRange = getDateRange(period, startDate, endDate);
      console.log('📅 Date range calculated:', dateRange);
    } catch (err) {
      console.error('❌ Error calculating date range:', err);
      dateRange = getDateRange('7days');
    }

    if (!dateRange.startDateISO || !dateRange.endDateISO) {
      console.error('❌ Invalid date range:', dateRange);
      dateRange = getDateRange('7days');
    }

    // Get user details first
    const [userDetails] = await db.execute(
      `SELECT name, employee_id FROM users WHERE id = ?`,
      [targetUserId]
    );

    const profileQuery = `
      SELECT 
        cv.profile_id,
        MAX(p.name) as profile_name,
        MAX(p.company_name) as company_name,
        MAX(p.designation) as designation,
        MAX(p.current_location) as current_location,
        MAX(p.phone) as phone,
        MAX(p.email) as email,
        MAX(p.total_experience) as total_experience,
        MAX(u.name) as user_name,
        MAX(u.employee_id) as employee_id,
        MAX(u.department) as user_department,
        COUNT(cv.id) as views_by_user,
        DATE_FORMAT(
          MAX(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')),
          '%d/%m/%Y %h:%i:%s %p'
        ) AS last_viewed_formatted,
        MAX(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) AS last_viewed_iso
      FROM contact_views cv
      LEFT JOIN profiles p ON cv.profile_id = p.id
      LEFT JOIN users u ON cv.viewer_user_id = u.id
      WHERE cv.viewer_user_id = ?
        AND DATE(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?
      GROUP BY cv.profile_id
      ORDER BY MAX(cv.viewed_at) DESC
    `;

    console.log('🔍 Executing profile query with params:', {
      userId: targetUserId,
      startDate: dateRange.startDateISO,
      endDate: dateRange.endDateISO
    });

    const [viewedProfiles] = await db.execute(profileQuery, [
      targetUserId, 
      dateRange.startDateISO, 
      dateRange.endDateISO
    ]);

    console.log(`📊 Found ${viewedProfiles.length} profiles viewed in date range`);

    // Get total views for each profile by all users
    const formattedProfiles = await Promise.all(viewedProfiles.map(async (profile) => {
      const [totalViewsResult] = await db.execute(
        `SELECT COUNT(*) as total 
         FROM contact_views 
         WHERE profile_id = ? 
         AND DATE(CONVERT_TZ(viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?`,
        [profile.profile_id, dateRange.startDateISO, dateRange.endDateISO]
      );
      
      const totalViewsAllUsers = totalViewsResult[0]?.total || 0;
      
      return {
        id: profile.profile_id,
        profile_id: profile.profile_id,
        profile_name: profile.profile_name || "Not specified",
        company_name: profile.company_name || "—",
        designation: profile.designation || "—",
        location: profile.current_location || "—",
        phone: profile.phone || "—",
        email: profile.email || "—",
        experience: profile.total_experience || "—",
        viewer_name: profile.user_name,
        viewer_department: profile.user_department,
        user_name: profile.user_name,
        employee_id: profile.employee_id,
        user_department: profile.user_department,
        views_by_user: profile.views_by_user || 0,
        total_views_all_users: totalViewsAllUsers,
        last_viewed_formatted: profile.last_viewed_formatted || null,
        last_viewed_iso: profile.last_viewed_iso ? profile.last_viewed_iso.toISOString() : null,
      };
    }));

    const [summary] = await db.execute(
      `SELECT 
        COALESCE(COUNT(DISTINCT cv.id), 0) AS total_views,
        COALESCE(COUNT(DISTINCT cv.profile_id), 0) AS unique_profiles,
        DATE_FORMAT(MIN(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')), '%d/%m/%Y %h:%i:%s %p') AS first_view,
        DATE_FORMAT(MAX(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')), '%d/%m/%Y %h:%i:%s %p') AS last_view
      FROM contact_views cv
      WHERE cv.viewer_user_id = ?
        AND DATE(CONVERT_TZ(cv.viewed_at, '+00:00', '+05:30')) BETWEEN ? AND ?`,
      [targetUserId, dateRange.startDateISO, dateRange.endDateISO]
    );

    res.json({
      success: true,
      data: {
        profiles: formattedProfiles,
        summary: {
          total_views: summary[0]?.total_views ?? 0,
          unique_profiles: summary[0]?.unique_profiles ?? 0,
          first_view: summary[0]?.first_view ?? null,
          last_view: summary[0]?.last_view ?? null,
          user_name: userDetails[0]?.name ?? "Unknown User",
          employee_id: userDetails[0]?.employee_id ?? "—"
        },
        period: period,
        dateRange: {
          startDate: dateRange.startDateDisplay,
          endDate: dateRange.endDateDisplay
        }
      },
    });

  } catch (error) {
    console.error("❌ Error fetching viewed profiles:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch viewed profiles",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: Single Activity Details
// ===========================================
router.get("/activity/:activityId", requireAuth, async (req, res) => {
  console.log(`📞 ACTIVITY ENDPOINT EXECUTING for ID: ${req.params.activityId}`);
  
  try {
    const { activityId } = req.params;
    const db = await connectDB();

    const [rows] = await db.execute(
      `SELECT 
        a.*,
        u.name as user_name,
        u.employee_id,
        u.department as user_department,
        p.id as profile_id,
        p.name as profile_name,
        p.candidate_name,
        p.company_name,
        p.designation,
        p.current_location,
        p.phone,
        p.email,
        p.total_experience,
        p.qualification,
        p.last_education,
        p.notice_period,
        p.key_skills,
        p.annual_salary,
        p.previous_employer
      FROM activity_logs a
      LEFT JOIN profiles p ON a.profile_id = p.id
      JOIN users u ON a.user_id = u.id
      WHERE a.id = ?`,
      [activityId]
    );

    if (rows.length === 0) {
      console.log(`❌ Activity ${activityId} not found`);
      return res.status(404).json({
        success: false,
        message: "Activity not found"
      });
    }

    const activity = rows[0];
    
    const formatPhone = (phone) => {
      if (!phone) return "";
      return String(phone).replace('.0', '');
    };

    const response = {
      success: true,
      data: {
        id: activity.id,
        user_id: activity.user_id,
        profile_id: activity.profile_id,
        department: activity.department,
        status: activity.status,
        duration: activity.duration || "00:00:00",
        note: activity.note || "",
        candidate_location: activity.candidate_location || "",
        created_at: activity.created_at,
        user_name: activity.user_name,
        employee_id: activity.employee_id,
        user_department: activity.user_department,
        profile_name: activity.profile_name || "Unknown",
        candidate_name: activity.candidate_name || activity.profile_name || "Unknown",
        company_name: activity.company_name || "—",
        designation: activity.designation || "—",
        current_location: activity.current_location || activity.candidate_location || "—",
        phone: formatPhone(activity.phone),
        email: activity.email || "",
        total_experience: activity.total_experience || "—",
        qualification: activity.qualification || "—",
        last_education: activity.last_education || "—",
        education: activity.qualification || activity.last_education || "—",
        notice_period: activity.notice_period || "—",
        key_skills: activity.key_skills || "—",
        annual_salary: activity.annual_salary || "—",
        previous_employer: activity.previous_employer || "—"
      }
    };

    console.log(`✅ Sending response for activity ${activityId}`);
    res.json(response);

  } catch (error) {
    console.error("❌ Error fetching activity:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch activity details",
      error: error.message
    });
  }
});

// ===========================================
// PUT: Update Activity Status
// ===========================================
router.put("/activity/:activityId/status", requireAuth, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const db = await connectDB();
    
    await db.execute(
      `UPDATE activity_logs SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, activityId]
    );

    const [updatedActivity] = await db.execute(
      `SELECT * FROM activity_logs WHERE id = ?`,
      [activityId]
    );

    res.json({
      success: true,
      message: "Status updated successfully",
      data: updatedActivity[0],
    });
  } catch (error) {
    console.error("❌ Error updating activity status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// POST: Update Activity
// ===========================================
router.post("/activity/update", requireAuth, async (req, res) => {
  try {
    const { activityId, status, duration, note, candidate_location, department } = req.body;
    const userId = req.user.id;

    if (!activityId) {
      return res.status(400).json({
        success: false,
        message: "Activity ID is required",
      });
    }

    const db = await connectDB();

    const [existingActivity] = await db.execute(
      `SELECT * FROM activity_logs WHERE id = ? AND user_id = ?`,
      [activityId, userId]
    );

    if (existingActivity.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Activity not found or access denied",
      });
    }

    const updateQuery = `
      UPDATE activity_logs 
      SET 
        status = COALESCE(?, status),
        duration = COALESCE(?, duration),
        note = COALESCE(?, note),
        candidate_location = COALESCE(?, candidate_location),
        department = COALESCE(?, department),
        updated_at = NOW()
      WHERE id = ?
    `;

        await db.execute(updateQuery, [
      status || null,
      duration || null,
      note || null,
      candidate_location || null,
      department || null,
      activityId
    ]);

    const [updatedActivity] = await db.execute(
      `SELECT * FROM activity_logs WHERE id = ?`,
      [activityId]
    );

    res.json({
      success: true,
      message: "Activity updated successfully",
      data: updatedActivity[0],
    });
  } catch (error) {
    console.error("❌ Error updating activity:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update activity",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: User Activities - FIXED
// ===========================================
router.get("/activities", requireAuth, async (req, res) => {
  let whereConditions = [];
  let params = [];
  
  try {
    const { userId, limit = 7, status, page = 1, search = "", startDate, endDate } = req.query;
    const currentUser = req.user;
    const accessLevel = getUserAccessLevel(req);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId parameter is required",
      });
    }

    const userIdNum = parseInt(userId);
    if (isNaN(userIdNum)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId parameter",
      });
    }

    if (accessLevel !== "admin" && currentUser.id !== userIdNum) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own activities",
      });
    }

    const db = await connectDB();
    const period = req.query.period || "7days";
    const customStart = startDate && startDate.trim() ? startDate : null;
    const customEnd = endDate && endDate.trim() ? endDate : null;
    const dateRange = getDateRange(period, customStart, customEnd);

    if (!dateRange.startDateISO || !dateRange.endDateISO) {
      return res.status(400).json({
        success: false,
        message: "Invalid date range",
      });
    }

    const startDateStr = String(dateRange.startDateISO).trim();
    const endDateStr = String(dateRange.endDateISO).trim();

    // Build WHERE conditions
    whereConditions = ["a.user_id = ?"];
    params = [userIdNum];

    whereConditions.push(`DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?`);
    params.push(startDateStr, endDateStr);

    if (status && status !== "all" && status !== "") {
      whereConditions.push("a.status = ?");
      params.push(status);
    }

    if (search && search.trim() !== "") {
      whereConditions.push(`(
        p.name LIKE ? OR 
        a.candidate_location LIKE ? OR 
        a.status LIKE ? OR
        DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) LIKE ?
      )`);
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM activity_logs a
      LEFT JOIN profiles p ON a.profile_id = p.id
      ${whereClause}
    `;

    const [countResult] = await db.execute(countQuery, params);
    const totalCount = countResult[0]?.total || 0;

    // Pagination values
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 7;
    const offsetNum = (pageNum - 1) * limitNum;

    let query = `
      SELECT 
        a.id,
        a.user_id,
        a.profile_id,
        a.department,
        a.status,
        a.duration,
        a.note,
        a.candidate_location,
        a.created_at,
        a.updated_at,
        u.name as user_name,
        u.department as user_department,
        u.employee_id,
        p.name as profile_name,
        p.candidate_name,
        p.company_name,
        p.current_location,
        p.phone,
        p.email,
        DATE_FORMAT(CONVERT_TZ(a.created_at, '+00:00', '+05:30'), '%Y-%m-%d %H:%i:%s') as created_at_ist,
        DATE_FORMAT(CONVERT_TZ(a.created_at, '+00:00', '+05:30'), '%d/%m/%Y %h:%i:%s %p') as created_at_formatted
      FROM activity_logs a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN profiles p ON a.profile_id = p.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

    console.log(`📋 Activities Query Build:\n    User ID: ${userIdNum}\n    Start Date: "${startDateStr}" (type: ${typeof startDateStr})\n    End Date: "${endDateStr}" (type: ${typeof endDateStr})\n    Params Count: ${params.length}\n    Where Conditions: ${whereConditions.length}`);

    console.log('🔎 Executing activities SQL with params:', params, 'limit:', limitNum, 'offset:', offsetNum);
    try {
      console.log('🔎 SQL:', query.replace(/\s+/g, ' '));
    } catch (e) {
      /* ignore */
    }

    const [activities] = await db.execute(query, params);

    // Log the first activity to see if note is present
    if (activities.length > 0) {
      console.log("Sample activity from DB:", {
        id: activities[0].id,
        note: activities[0].note,
        status: activities[0].status
      });
    }

    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      user_id: activity.user_id,
      profile_id: activity.profile_id,
      department: activity.department,
      status: activity.status,
      duration: activity.duration || "00:00:00",
      note: activity.note || "",
      notes: activity.note || "",
      candidate_location: activity.candidate_location || "—",
      created_at: activity.created_at_ist || activity.created_at,
      created_at_ist: activity.created_at_ist,
      created_at_formatted: activity.created_at_formatted,
      user_name: activity.user_name,
      user_department: activity.user_department,
      employee_id: activity.employee_id,
      profile_name: activity.profile_name || "Unknown",
      candidate_name: activity.candidate_name || activity.profile_name || "Unknown",
      company_name: activity.company_name || "—",
      current_location: activity.current_location || activity.candidate_location || "—",
      phone: activity.phone || "",
      email: activity.email || ""
    }));

    res.json({
      success: true,
      data: formattedActivities,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      },
      dateRange
    });

  } catch (error) {
    console.error("❌ Error fetching user activities:", error);
    console.error("📊 Query debug info:", {
      whereConditions: whereConditions?.length || 0,
      paramsCount: params?.length || 0,
      error: error.message,
      code: error.code
    });
    res.status(500).json({
      success: false,
      message: "Failed to fetch activities",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
});

// ===========================================
// GET: Candidate History
// ===========================================
router.get("/candidate-history/:profileId/:userId", requireAuth, async (req, res) => {
  try {
    const { profileId, userId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const db = await connectDB();
    const period = req.query.period || "7days";
    const dateRange = getDateRange(period, startDate, endDate);

    const [activities] = await db.execute(
      `
      SELECT 
        a.*,
        u.name as user_name,
        u.employee_id,
        u.department,
        p.name as profile_name,
        p.company_name,
        p.current_location,
        p.phone,
        p.email,
        DATE_FORMAT(CONVERT_TZ(a.created_at, '+00:00', '+05:30'), '%Y-%m-%d %H:%i:%s') as created_at_ist,
        DATE_FORMAT(CONVERT_TZ(a.created_at, '+00:00', '+05:30'), '%d/%m/%Y %h:%i:%s %p') as created_at_formatted
      FROM activity_logs a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN profiles p ON a.profile_id = p.id
      WHERE a.profile_id = ? AND a.user_id = ?
        AND DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
      ORDER BY a.created_at DESC
      `,
      [profileId, userId, dateRange.startDateISO, dateRange.endDateISO]
    );

    res.json({
      success: true,
      data: activities,
      dateRange
    });
  } catch (error) {
    console.error("❌ Error fetching candidate history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch candidate history",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: All Locations
// ===========================================
router.get("/locations", requireAuth, async (req, res) => {
  try {
    const accessLevel = getUserAccessLevel(req);
    const { startDate, endDate } = req.query;
    const db = await connectDB();

    const period = req.query.period || "7days";
    const dateRange = getDateRange(period, startDate, endDate);

    let query = `
      SELECT DISTINCT candidate_location as location
      FROM activity_logs
      WHERE candidate_location IS NOT NULL AND candidate_location != ''
        AND DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;

    const params = [dateRange.startDateISO, dateRange.endDateISO];

    if (accessLevel !== "admin") {
      query += ` AND department = ?`;
      params.push(getDepartmentFilter(accessLevel, req.user.department));
      query += ` AND user_id = ?`;
      params.push(req.user.id);
    }

    query += ` ORDER BY candidate_location`;

    const [locations] = await db.execute(query, params);

    res.json({
      success: true,
      data: locations.map((l) => l.location),
      dateRange
    });
  } catch (error) {
    console.error("❌ Error fetching locations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch locations",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: Summary Statistics
// ===========================================
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const accessLevel = getUserAccessLevel(req);
    const { startDate, endDate } = req.query;
    const db = await connectDB();

    const period = req.query.period || "7days";
    const dateRange = getDateRange(period, startDate, endDate);

    let query = `
      SELECT 
        COUNT(DISTINCT a.id) as total_activities,
        COUNT(DISTINCT a.user_id) as active_users_today,
        COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(a.duration))), '00:00:00') as total_duration_today,
        SUM(CASE WHEN a.status = 'closed' THEN 1 ELSE 0 END) as closed_today
      FROM activity_logs a
      WHERE DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) = CURDATE()
    `;

    const params = [];

    if (accessLevel !== "admin") {
      query += ` AND a.department = ?`;
      params.push(getDepartmentFilter(accessLevel, req.user.department));
      query += ` AND a.user_id = ?`;
      params.push(req.user.id);
    }

    const [summary] = await db.execute(query, params);

    let periodQuery = `
      SELECT 
        COUNT(*) as activities_this_period,
        COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(duration))), '00:00:00') as duration_this_period
      FROM activity_logs
      WHERE DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;

    const periodParams = [dateRange.startDateISO, dateRange.endDateISO];

    if (accessLevel !== "admin") {
      periodQuery += ` AND department = ?`;
      periodParams.push(getDepartmentFilter(accessLevel, req.user.department));
      periodQuery += ` AND user_id = ?`;
      periodParams.push(req.user.id);
    }

    const [periodStats] = await db.execute(periodQuery, periodParams);

    res.json({
      success: true,
      data: {
        today: summary[0] || {
          total_activities: 0,
          active_users_today: 0,
          total_duration_today: "00:00:00",
          closed_today: 0,
        },
        period: periodStats[0] || {
          activities_this_period: 0,
          duration_this_period: "00:00:00",
        },
      },
      dateRange
    });
  } catch (error) {
    console.error("❌ Error fetching summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch summary",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: Email Logs
// ===========================================
router.get("/email-logs", requireAuth, async (req, res) => {
  try {
    const accessLevel = getUserAccessLevel(req);
    const { department = "all", startDate, endDate, user_id } = req.query;
    const db = await connectDB();

    const period = req.query.period || "monthly";
    const dateRange = getDateRange(period, startDate, endDate);

    let query = `
      SELECT 
        el.*,
        u.name as user_name,
        u.department as user_department,
        u.employee_id,
        p.name as profile_name,
        p.company_name,
        DATE_FORMAT(CONVERT_TZ(el.sent_at, '+00:00', '+05:30'), '%Y-%m-%d %H:%i:%s') as sent_at_ist,
        DATE_FORMAT(CONVERT_TZ(el.sent_at, '+00:00', '+05:30'), '%d/%m/%Y %h:%i:%s %p') as sent_at_formatted
      FROM email_logs el
      LEFT JOIN users u ON el.user_id = u.id
      LEFT JOIN profiles p ON el.profile_id = p.id
      WHERE DATE(CONVERT_TZ(el.sent_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;

    const params = [dateRange.startDateISO, dateRange.endDateISO];

    if (department && department !== "all") {
      let deptParam = department;
      if (department === "BD") deptParam = "Business Development";
      if (department === "Recruit") deptParam = "Recruitment";
      if (department === "Franchise") deptParam = "Franchise";
      
      query += ` AND u.department = ?`;
      params.push(deptParam);
    }

    if (accessLevel !== "admin" || user_id) {
      query += ` AND el.user_id = ?`;
      params.push(user_id || req.user.id);
    }

    query += ` ORDER BY el.sent_at DESC`;

    const [emailLogs] = await db.execute(query, params);

    const formattedLogs = emailLogs.map(log => ({
      id: log.id,
      profile_id: log.profile_id,
      user_id: log.user_id,
      candidate_name: log.candidate_name,
      candidate_email: log.candidate_email,
      email_type: log.email_type,
      email_subject: log.email_subject,
      email_content: log.email_content,
      sent_at: log.sent_at_ist || log.sent_at,
      status: log.status,
      reply_to_email: log.reply_to_email || 'N/A',
      user_name: log.user_name,
      department: log.user_department,
      employee_id: log.employee_id,
      profile_name: log.profile_name,
      company_name: log.company_name
    }));

    res.json({
      success: true,
      data: formattedLogs,
      period,
      dateRange
    });

  } catch (error) {
    console.error("❌ Error fetching email logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch email logs",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: User Candidates (Admin only)
// ===========================================
router.get("/user-candidates/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { search = "", status = "all", startDate, endDate } = req.query;
    
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const db = await connectDB();
    const period = req.query.period || "7days";
    const dateRange = getDateRange(period, startDate, endDate);

    let query = `
      SELECT DISTINCT 
        a.profile_id,
        p.name as profile_name,
        p.company_name,
        p.current_location,
        p.phone,
        p.email,
        p.total_experience,
        p.designation,
        a.user_id,
        u.name as user_name,
        u.employee_id,
        u.department,
        a.department as activity_department,
        (
          SELECT status 
          FROM activity_logs a2 
          WHERE a2.profile_id = a.profile_id 
          AND a2.user_id = a.user_id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) as latest_status,
        (
          SELECT duration 
          FROM activity_logs a2 
          WHERE a2.profile_id = a.profile_id 
          AND a2.user_id = a.user_id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) as latest_duration,
        (
          SELECT CONVERT_TZ(created_at, '+00:00', '+05:30') 
          FROM activity_logs a2 
          WHERE a2.profile_id = a.profile_id 
          AND a2.user_id = a.user_id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) as latest_date,
        (
          SELECT COUNT(*) 
          FROM activity_logs a2 
          WHERE a2.profile_id = a.profile_id 
          AND a2.user_id = a.user_id
          AND DATE(CONVERT_TZ(a2.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
        ) as total_calls,
        (
          SELECT COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(duration))), '00:00:00') 
          FROM activity_logs a2 
          WHERE a2.profile_id = a.profile_id 
          AND a2.user_id = a.user_id
          AND DATE(CONVERT_TZ(a2.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
        ) as total_call_hours
      FROM activity_logs a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN profiles p ON a.profile_id = p.id
      WHERE a.user_id = ?
        AND a.profile_id IS NOT NULL
        AND DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;

    const params = [
      dateRange.startDateISO, dateRange.endDateISO,
      dateRange.startDateISO, dateRange.endDateISO,
      userId,
      dateRange.startDateISO, dateRange.endDateISO
    ];

    if (search && search.trim() !== "") {
      query += ` AND (
        p.name LIKE ? OR 
        p.company_name LIKE ? OR 
        p.current_location LIKE ? OR
        p.phone LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status && status !== "all") {
      query += ` AND a.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY latest_date DESC`;

    const [candidates] = await db.execute(query, params);

    const formattedCandidates = candidates.map(candidate => ({
      id: candidate.profile_id,
      profile_id: candidate.profile_id,
      candidate_name: candidate.profile_name || "Unknown",
      company_name: candidate.company_name || "N/A",
      candidate_location: candidate.current_location || "N/A",
      phone: candidate.phone || "N/A",
      email: candidate.email || "N/A",
      user_name: candidate.user_name,
      employee_id: candidate.employee_id,
      department: candidate.department,
      status: candidate.latest_status || "in-progress",
      duration: candidate.latest_duration || "00:00:00",
      created_at: candidate.latest_date,
      total_calls: candidate.total_calls || 0,
      total_call_hours: candidate.total_call_hours || "00:00:00",
      user_id: candidate.user_id
    }));

    res.json({
      success: true,
      data: formattedCandidates,
      dateRange
    });
  } catch (error) {
    console.error("❌ Error fetching user candidates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user candidates",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: Export User Activity Report with Notes
// ===========================================
router.get("/export-user-activity/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, status, search } = req.query;
    const currentUser = req.user;
    const accessLevel = getUserAccessLevel(req);

    if (accessLevel !== "admin" && currentUser.id !== parseInt(userId, 10)) {
      return res.status(403).json({
        success: false,
        message: "You can only export your own activity reports",
      });
    }

    const db = await connectDB();

    let dateRange = {};
    if (startDate && endDate) {
      dateRange = {
        startDateISO: startDate,
        endDateISO: endDate,
      };
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      dateRange = {
        startDateISO: start.toISOString().split("T")[0],
        endDateISO: end.toISOString().split("T")[0],
      };
    }

    let query = `
      SELECT 
        a.id,
        a.user_id,
        a.profile_id,
        a.department,
        a.status,
        a.duration,
        a.note,
        a.candidate_location,
        DATE_FORMAT(CONVERT_TZ(a.created_at, '+00:00', '+05:30'), '%d/%m/%Y %h:%i:%s %p') as created_at_ist,
        u.name as user_name,
        u.employee_id,
        p.name as candidate_name,
        p.company_name,
        p.designation,
        p.phone,
        p.email,
        p.total_experience,
        p.current_location as profile_location
      FROM activity_logs a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN profiles p ON a.profile_id = p.id
      WHERE a.user_id = ?
        AND DATE(CONVERT_TZ(a.created_at, '+00:00', '+05:30')) BETWEEN ? AND ?
    `;

    const params = [userId, dateRange.startDateISO, dateRange.endDateISO];

    if (status && status !== "all" && status !== "") {
      query += ` AND a.status = ?`;
      params.push(status);
    }

    if (search && search.trim() !== "") {
      query += ` AND (
        p.name LIKE ? OR 
        p.company_name LIKE ? OR 
        a.note LIKE ? OR
        a.candidate_location LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY a.created_at DESC`;

    const [activities] = await db.execute(query, params);

    const formattedActivities = activities.map(activity => ({
      'Date & Time (IST)': activity.created_at_ist || 'N/A',
      'Candidate Name': activity.candidate_name || 'N/A',
      'Company': activity.company_name || 'N/A',
      'Designation': activity.designation || 'N/A',
      'Phone': activity.phone || 'N/A',
      'Email': activity.email || 'N/A',
      'Status': activity.status || 'N/A',
      'Duration': activity.duration || '00:00:00',
      'Call Location': activity.candidate_location || activity.profile_location || 'N/A',
      'Note/Remark': activity.note || '',
      'Department': activity.department || 'N/A',
      'Employee ID': activity.employee_id || 'N/A',
      'User Name': activity.user_name || 'N/A',
      'Total Experience': activity.total_experience || 'N/A'
    }));

    res.json({
      success: true,
      data: formattedActivities,
      count: formattedActivities.length,
      dateRange: {
        startDate: dateRange.startDateISO,
        endDate: dateRange.endDateISO
      },
      userInfo: {
        userId: userId,
        userName: activities[0]?.user_name || 'Unknown',
        employeeId: activities[0]?.employee_id || 'N/A'
      }
    });

  } catch (error) {
    console.error("❌ Error exporting user activity:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export user activity",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: Profile by ID
// ===========================================
router.get("/profiles/:profileId", requireAuth, async (req, res) => {
  try {
    const { profileId } = req.params;
    const db = await connectDB();

    const [profile] = await db.execute(
      `SELECT * FROM profiles WHERE id = ?`,
      [profileId]
    );

    if (profile.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    res.json({
      success: true,
      data: profile[0],
    });
  } catch (error) {
    console.error("❌ Error fetching profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: Profile History
// ===========================================
router.get("/profile-history/:profileId", requireAuth, async (req, res) => {
  try {
    const { profileId } = req.params;
    const db = await connectDB();

    const [profileCheck] = await db.execute(
      `SELECT id, name FROM profiles WHERE id = ?`,
      [profileId]
    );

    if (profileCheck.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: "Profile not found"
      });
    }

    const [activities] = await db.execute(
      `
      SELECT 
        a.*,
        u.id as user_id,
        u.name as user_name,
        u.employee_id,
        u.department as user_department,
        u.is_admin,
        DATE_FORMAT(CONVERT_TZ(a.created_at, '+00:00', '+05:30'), '%Y-%m-%d %H:%i:%s') as created_at_ist,
        DATE_FORMAT(CONVERT_TZ(a.created_at, '+00:00', '+05:30'), '%d/%m/%Y %h:%i:%s %p') as created_at_formatted
      FROM activity_logs a
      JOIN users u ON a.user_id = u.id
      WHERE a.profile_id = ?
      ORDER BY a.created_at DESC
      `,
      [profileId]
    );
    
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      user_id: activity.user_id,
      profile_id: activity.profile_id,
      department: activity.department,
      status: activity.status,
      duration: activity.duration,
      note: activity.note || activity.notes || activity.remark || activity.remarks || activity.activity_note || activity.call_notes || activity.note_text || "",
      candidate_location: activity.candidate_location,
      user_name: activity.user_name,
      employee_id: activity.employee_id,
      is_admin: activity.is_admin,
      created_at: activity.created_at_ist,
      created_at_formatted: activity.created_at_formatted,
      created_at_formatted_ist: activity.created_at_formatted,
    }));

    res.json({
      success: true,
      data: formattedActivities,
      count: formattedActivities.length,
      profile_name: profileCheck[0].name
    });

  } catch (error) {
    console.error("❌ Error fetching profile history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile history",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: Candidate Conflict
// ===========================================
router.get("/candidate-conflict/:activityId", requireAuth, async (req, res) => {
  try {
    const { activityId } = req.params;
    const db = await connectDB();

    const [activity] = await db.execute(
      `SELECT profile_id FROM activity_logs WHERE id = ?`,
      [activityId]
    );

    if (activity.length === 0) {
      return res.json({
        success: true,
        data: { active: false }
      });
    }

    const profileId = activity[0].profile_id;

    if (!profileId) {
      return res.json({
        success: true,
        data: { active: false }
      });
    }

    const [activeAssignments] = await db.execute(
      `SELECT 
        a.user_id,
        u.name as user_name,
        u.employee_id,
        u.department,
        a.status,
        MAX(a.created_at) as last_activity
      FROM activity_logs a
      JOIN users u ON a.user_id = u.id
      WHERE a.profile_id = ? 
        AND a.status IN ('in-progress', 'follow-up', 'updated')
        AND CONVERT_TZ(a.created_at, '+00:00', '+05:30') > DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY a.user_id, u.name, u.employee_id, u.department, a.status
      ORDER BY last_activity DESC
      LIMIT 1`,
      [profileId]
    );

    if (activeAssignments.length === 0) {
      return res.json({
        success: true,
        data: { active: false }
      });
    }

    const activeAssignment = activeAssignments[0];
    const isCurrentUser = activeAssignment.user_id === req.user.id;

    res.json({
      success: true,
      data: {
        active: !isCurrentUser,
        user_id: activeAssignment.user_id,
        user_name: activeAssignment.user_name,
        employee_id: activeAssignment.employee_id,
        department: activeAssignment.department,
        status: activeAssignment.status,
        last_activity: activeAssignment.last_activity
      }
    });

  } catch (error) {
    console.error("❌ Error checking candidate conflict:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check candidate conflict",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// POST: Track Click
// ===========================================
router.post("/track-click", requireAuth, async (req, res) => {
  try {
    const { profile_id } = req.body;
    const userId = req.user.id;

    if (!profile_id) {
      return res.status(400).json({
        success: false,
        message: "Profile ID is required",
      });
    }

    const db = await connectDB();

    const [profileCheck] = await db.execute(
      `SELECT id FROM profiles WHERE id = ?`,
      [profile_id]
    );

    if (profileCheck.length === 0) {
      console.log(`⚠️ Profile ${profile_id} not found, skipping click tracking`);
      return res.json({
        success: true,
        message: "Profile not found, click not tracked",
      });
    }

    const [recentClicks] = await db.execute(
      `SELECT id FROM contact_views 
       WHERE viewer_user_id = ? AND profile_id = ? 
       AND DATE(CONVERT_TZ(viewed_at, '+00:00', '+05:30')) = CURDATE()`,
      [userId, profile_id]
    );

    if (recentClicks.length === 0) {
      await db.execute(
        `INSERT INTO contact_views (profile_id, viewer_user_id, viewer_name, viewer_department, viewed_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [profile_id, userId, req.user.name, req.user.department]
      );

      await db.execute(
        "UPDATE users SET click_count = COALESCE(click_count, 0) + 1 WHERE id = ?",
        [userId]
      );
      
      console.log(`✅ Click tracked: User ${userId} viewed profile ${profile_id}`);
    }

    res.json({
      success: true,
      message: "Click tracked successfully",
    });
  } catch (error) {
    console.error("❌ Error tracking click:", error);
    res.status(500).json({
      success: false,
      message: "Failed to track click",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
});

// ===========================================
// GET: Health Check
// ===========================================
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Reports API is running",
    timestamp: new Date().toISOString(),
    endpoints: {
      statusDetails: "GET /api/reports/status-details",
      dashboard: "GET /api/reports/dashboard",
      clickCounts: "GET /api/reports/click-counts",
      clickTrends: "GET /api/reports/click-trends",
      loginStats: "GET /api/reports/login-stats",
      activity: "GET /api/reports/activity/:activityId",
      updateStatus: "PUT /api/reports/activity/:activityId/status",
      updateActivity: "POST /api/reports/activity/update",
      profileHistory: "GET /api/reports/profile-history/:profileId",
      trackClick: "POST /api/reports/track-click",
      activities: "GET /api/reports/activities",
      candidateHistory: "GET /api/reports/candidate-history/:profileId/:userId",
      candidateConflict: "GET /api/reports/candidate-conflict/:activityId",
      userCandidates: "GET /api/reports/user-candidates/:userId",
      viewedProfiles: "GET /api/reports/viewed-profiles/:userId",
      locations: "GET /api/reports/locations",
      locationStats: "GET /api/reports/location-stats",
      locationDetails: "GET /api/reports/location-details",
      summary: "GET /api/reports/summary",
      emailLogs: "GET /api/reports/email-logs",
      profiles: "GET /api/reports/profiles/:profileId"
    },
  });
});

export default router;
