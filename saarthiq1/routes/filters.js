// backend/routes/filters.js - OPTIMIZED VERSION WITH CACHING
import express from 'express';
import { connectDB } from '../db.js';
import { cacheResponse, cacheService } from '../middleware/cache.js';
import { validateApiKey } from '../middleware/apiKeyAuth.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const toStr = (v) => (typeof v === 'string' ? v.trim() : '');

// Cache TTLs
const OPTIONS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CASCADING_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const flexAuth = (req, res, next) => {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer sk_live_') || auth.startsWith('Bearer sk_test_')) {
    return validateApiKey(req, res, next);
  }
  if (auth.startsWith('Bearer ')) {
    return requireAuth(req, res, next);
  }
  return next(); // ← allow public access for deep-link
};
// ==================================================
// 0. GET STATS (TOTAL PROFILES)
// ==================================================
router.get('/stats', async (req, res) => {
  try {
    const db = await connectDB();
    const [rows] = await db.query('SELECT COUNT(*) as count FROM profiles WHERE id IS NOT NULL AND name IS NOT NULL');
    res.json({ totalProfiles: rows[0].count || 0 });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ==================================================
// 1.1 GET VIEWED STATUS (BD Users Only)
// ==================================================
router.post('/viewed-status', async (req, res) => {
  try {
    const { profileIds, userId, userName } = req.body;

    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      return res.json({});
    }

    if (!userId || userId === '' || userId === 'null' || userId === 'undefined') {
      return res.status(400).json({ error: 'Valid User ID is required' });
    }

    const db = await connectDB();
    const numericProfileIds = profileIds
      .map(id => { const num = parseInt(id); return isNaN(num) ? null : num; })
      .filter(id => id !== null);

    if (numericProfileIds.length === 0) return res.json({});

    const placeholders = numericProfileIds.map(() => '?').join(',');

    const [rows] = await db.query(
      `SELECT p.id as profile_id, pv.user_id as viewed_by_user_id,
        pv.user_name as viewed_by_name, DATE(pv.viewed_at) as viewed_date,
        pv.department as viewer_department
       FROM profiles p
       LEFT JOIN profile_views pv ON p.id = pv.profile_id
       WHERE p.id IN (${placeholders})
       ORDER BY pv.viewed_at DESC`,
      numericProfileIds
    );

    const viewedStatus = {};
    rows.forEach(row => {
      if (row.viewed_by_user_id) {
        const profileId = row.profile_id;
        const rowUserId = String(row.viewed_by_user_id);
        const reqUserId = String(userId);
        let displayName = row.viewed_by_name || 'User';

        if (rowUserId === reqUserId && userName && userName !== 'User') {
          displayName = userName;
        }

        if (!viewedStatus[profileId]) {
          viewedStatus[profileId] = {
            viewed_by_user_id: rowUserId,
            viewed_by_name: displayName,
            viewed_at: row.viewed_date,
            viewer_department: row.viewer_department,
            is_current_user: rowUserId === reqUserId,
            total_views: 1
          };
        }
      }
    });

    res.json(viewedStatus);
  } catch (err) {
    console.error('Viewed status error:', err);
    res.status(500).json({ error: 'Failed to fetch viewed status' });
  }
});

// ==================================================
// 1.2 MARK PROFILE AS VIEWED
// ==================================================
router.post('/mark-viewed', async (req, res) => {
  try {
    const { profileId, userId, userName, department } = req.body;

    if (!profileId) return res.status(400).json({ error: 'Profile ID required' });

    const db = await connectDB();
    const safeUserId = userId || `guest-${Date.now()}`;
    const numericProfileId = parseInt(profileId);
    
    if (isNaN(numericProfileId)) return res.status(400).json({ error: 'Invalid Profile ID' });

    await db.query(
      `INSERT INTO profile_views (profile_id, user_id, user_name, viewed_at, department)
       VALUES (?, ?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE viewed_at = NOW()`,
      [numericProfileId, safeUserId, userName || 'User', department || 'Unknown']
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Mark viewed error:', err);
    res.status(500).json({ error: 'Failed to mark profile as viewed' });
  }
});

// ==================================================
// 2. GET INITIAL OPTIONS (OPTIMIZED WITH CACHING)
// ==================================================
router.get('/options', 
  cacheResponse('filters:options', OPTIONS_CACHE_TTL),
  async (req, res) => {
    const { department = '' } = req.query;
    const dept = toStr(department);
    const isBD = dept.toLowerCase().includes('business development');

    try {
      const db = await connectDB();
      const response = {
        alphabetOptions: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
        locations: [], genders: [], industries: [], companies: [], designations: [],
        ageRanges: ['18-25', '26-40', '41-60', '60+'],
        educations: ['Graduated', 'Post Graduated', 'Unknown'],
        experienceRanges: ['0-2', '3-5', '6-10', '11-15', '16+'],
        salaryRanges: ['0-3', '3-6', '6-10', '10-15', '15-20', '20+']
      };

      // Gender - optimized with GROUP BY instead of DISTINCT
      const [genderRows] = await db.query(
        `SELECT gender FROM profiles USE INDEX (idx_gender) WHERE gender IS NOT NULL AND TRIM(gender) != '' GROUP BY gender LIMIT 10`
      );
      const allGenders = genderRows.map(r => r.gender).filter(Boolean);
      const hasMale = allGenders.some(g => g.toLowerCase() === 'male');
      const hasFemale = allGenders.some(g => g.toLowerCase() === 'female');

      const genderOptions = ['Both'];
      if (hasMale) genderOptions.push('Male');
      if (hasFemale) genderOptions.push('Female');
      response.genders = genderOptions;

      // Locations - optimized with index and GROUP BY
      const [locRows] = await db.query(
        `SELECT current_location FROM profiles USE INDEX (idx_location) WHERE current_location IS NOT NULL AND TRIM(current_location) != '' GROUP BY current_location ORDER BY current_location LIMIT 500`
      );
      response.locations = locRows.map(r => r.current_location).filter(Boolean);

      // Industries - optimized
      const [indRows] = await db.query(
        `SELECT industry FROM profiles USE INDEX (idx_industry) WHERE industry IS NOT NULL AND TRIM(industry) != '' GROUP BY industry ORDER BY industry LIMIT 500`
      );
      response.industries = indRows.map(r => r.industry).filter(Boolean);

      // Designations - optimized
      const [desRows] = await db.query(
        `SELECT designation FROM profiles USE INDEX (idx_designation) WHERE designation IS NOT NULL AND TRIM(designation) != '' GROUP BY designation ORDER BY designation LIMIT 500`
      );
      response.designations = desRows.map(r => r.designation).filter(Boolean);

      // Companies (BD only)
      if (isBD) {
        const [compRows] = await db.query(
          `SELECT company_name FROM profiles USE INDEX (idx_company_name) WHERE company_name IS NOT NULL AND TRIM(company_name) != '' GROUP BY company_name ORDER BY company_name LIMIT 500`
        );
        response.companies = compRows.map(r => r.company_name).filter(Boolean);
      }

      res.json(response);
    } catch (err) {
      console.error('Initial options error:', err);
      res.status(500).json({ message: 'Failed to load initial options', error: err.message });
    }
  }
);

// ==================================================
// 2.1 GET CASCADING OPTIONS (OPTIMIZED)
// ==================================================
router.post('/cascading-options', 
  cacheResponse('filters:cascading', CASCADING_CACHE_TTL),
  async (req, res) => {
    try {
      const { appliedFilters = {}, department = '' } = req.body;
      const dept = toStr(department);
      const isBD = dept.toLowerCase().includes('business development');
      const db = await connectDB();

      const response = {
        companies: [], industries: [], designations: [],
        locations: [], genders: ['Both'],
        ageRanges: ['18-25', '26-40', '41-60', '60+'],
        educations: ['Graduated', 'Post Graduated', 'Unknown'],
        experienceRanges: ['0-2', '3-5', '6-10', '11-15', '16+'],
        salaryRanges: ['0-3', '3-6', '6-10', '10-15', '15-20', '20+']
      };

      // Build WHERE clause from applied filters
      const conditions = [];
      const params = [];

      if (appliedFilters.location && appliedFilters.location.trim()) {
        conditions.push('current_location = ?');
        params.push(appliedFilters.location);
      }

      if (appliedFilters.gender && appliedFilters.gender !== 'Both') {
        if (appliedFilters.gender === 'No Data') {
          conditions.push("(gender IS NULL OR TRIM(gender) = '')");
        } else {
          conditions.push('gender = ?');
          params.push(appliedFilters.gender);
        }
      }

      if (appliedFilters.industry) {
        const arr = Array.isArray(appliedFilters.industry) 
          ? appliedFilters.industry.filter(i => i && i.trim())
          : [appliedFilters.industry].filter(i => i && i.trim());
        if (arr.length > 0) {
          conditions.push(`industry IN (${arr.map(() => '?').join(',')})`);
          params.push(...arr);
        }
      }

 const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const andOrWhere = conditions.length > 0 ? 'AND' : 'WHERE';

      // Get genders
      const genderQuery = `SELECT gender FROM profiles ${whereClause} ${andOrWhere} gender IS NOT NULL AND TRIM(gender) != '' GROUP BY gender LIMIT 10`;
      const [genderRows] = await db.query(genderQuery, params);
      const allGenders = genderRows.map(r => r.gender).filter(Boolean);
      const genderOptions = ['Both'];
      if (allGenders.some(g => g.toLowerCase() === 'male')) genderOptions.push('Male');
      if (allGenders.some(g => g.toLowerCase() === 'female')) genderOptions.push('Female');
      response.genders = genderOptions;

      // Get locations
      const locationQuery = `SELECT current_location FROM profiles ${whereClause} ${andOrWhere} current_location IS NOT NULL AND TRIM(current_location) != '' GROUP BY current_location ORDER BY current_location LIMIT 500`;
      const [locRows] = await db.query(locationQuery, params);
      response.locations = locRows.map(r => r.current_location).filter(Boolean);

      // Get industries (exclude current industry filter)
      let industryWhere = whereClause;
      let industryParams = [...params];
      if (appliedFilters.industry) {
        industryWhere = industryWhere.replace(/AND industry IN \([^)]+\)/, '');
      }
      const industryAndOrWhere = industryWhere.trim().startsWith('WHERE') ? 'AND' : 'WHERE';
      const industryQuery = `SELECT industry FROM profiles ${industryWhere} ${industryAndOrWhere} industry IS NOT NULL AND TRIM(industry) != '' GROUP BY industry ORDER BY industry LIMIT 500`;
      const [indRows] = await db.query(industryQuery, industryParams);
      response.industries = indRows.map(r => r.industry).filter(Boolean);

      // Get designations (exclude current designation filter)
      let designationWhere = whereClause;
      let designationParams = [...params];
      if (appliedFilters.designation) {
        const regex = /AND designation IN \([^)]+\)/g;
        designationWhere = designationWhere.replace(regex, '');
      }
      const designationAndOrWhere = designationWhere.trim().startsWith('WHERE') ? 'AND' : 'WHERE';
      const designationQuery = `SELECT designation FROM profiles ${designationWhere} ${designationAndOrWhere} designation IS NOT NULL AND TRIM(designation) != '' GROUP BY designation ORDER BY designation LIMIT 500`;
      const [desRows] = await db.query(designationQuery, designationParams);
      response.designations = desRows.map(r => r.designation).filter(Boolean);

      // Get companies (BD only)
      if (isBD) {
        const companyQuery = `SELECT company_name FROM profiles ${whereClause} ${andOrWhere} company_name IS NOT NULL AND TRIM(company_name) != '' GROUP BY company_name ORDER BY company_name LIMIT 500`;
        const [compRows] = await db.query(companyQuery, params);
        response.companies = compRows.map(r => r.company_name).filter(Boolean);
      }

      res.json(response);
    } catch (err) {
      console.error('Cascading options error:', err);
      res.status(500).json({ message: 'Failed to load cascading options', error: err.message });
    }
  }
);

// ==================================================
// 3. POST SEARCH (OPTIMIZED WITH INDEXES)
// ==================================================
router.post('/search', flexAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const nameSearch = body.nameSearch ? body.nameSearch.trim() : null;
    
    const toArr = (v) => v ? (Array.isArray(v) ? v.filter(Boolean) : (typeof v === 'string' && v.trim() ? [v.trim()] : [])) : [];

    const location = toArr(body.location);
    const gender = body.gender;
    const industry = toArr(body.industry);
    const company = toArr(body.company);
    const designation = toArr(body.designation);

    const ageRange = body.ageRange || null;
    const education = body.education || null;
    const experienceRange = body.experienceRange || null;
    const salaryRange = body.salaryRange || null;

    const sort = body.sort || 'experience_desc';
    const page = parseInt(body.page) || 1;
    const pageSize = parseInt(body.pageSize) || 10;
    const dept = toStr(body.department || '');
    const isBD = dept.toLowerCase().includes('business development');

    const db = await connectDB();
    let baseSql = `FROM profiles WHERE 1=1`;
    let params = [];

    // Name search
    if (nameSearch) {
  baseSql += ` AND (name LIKE ? OR designation LIKE ? OR last_education LIKE ? OR company_name LIKE ? OR current_location LIKE ?)`;
  params.push(`%${nameSearch}%`, `%${nameSearch}%`, `%${nameSearch}%`, `%${nameSearch}%`, `%${nameSearch}%`);
}

    // Location filter - uses idx_location
    if (location.length > 0) {
      baseSql += ` AND current_location IN (${location.map(() => '?').join(',')})`;
      params.push(...location);
    }

    // Gender filter
    if (gender && gender.length > 0) {
      const genderValues = Array.isArray(gender) ? gender : [gender];
      const hasBoth = genderValues.some(g => String(g).toLowerCase() === 'both');

      if (!hasBoth) {
        const hasNoData = genderValues.includes('No Data');
        const otherGenders = genderValues.filter(g => g !== 'No Data');

        if (hasNoData && otherGenders.length > 0) {
          baseSql += ` AND (gender IN (${otherGenders.map(() => '?').join(',')}) OR gender IS NULL OR TRIM(gender) = '')`;
          params.push(...otherGenders);
        } else if (hasNoData) {
          baseSql += ` AND (gender IS NULL OR TRIM(gender) = '')`;
        } else {
          baseSql += ` AND gender IN (${otherGenders.map(() => '?').join(',')})`;
          params.push(...otherGenders);
        }
      }
    }

    // Industry filter - uses idx_industry
    if (industry.length > 0) {
      baseSql += ` AND industry IN (${industry.map(() => '?').join(',')})`;
      params.push(...industry);
    }

    // Company filter - uses idx_company_name
    if (isBD && company.length > 0) {
      baseSql += ` AND company_name IN (${company.map(() => '?').join(',')})`;
      params.push(...company);
    }

    // Designation filter - uses idx_designation
    if (designation.length > 0) {
      baseSql += ` AND designation IN (${designation.map(() => '?').join(',')})`;
      params.push(...designation);
    }

    // Non-BD filters (age, education, experience, salary)
    if (!isBD) {
      if (ageRange) {
        if (ageRange.includes('+')) {
          const min = parseInt(ageRange);
          if (!isNaN(min)) {
            baseSql += ` AND age >= ?`;
            params.push(min);
          }
        } else {
          const [mn, mx] = ageRange.split('-').map(Number);
          if (!isNaN(mn) && !isNaN(mx)) {
            baseSql += ` AND age >= ? AND age <= ?`;
            params.push(mn, mx);
          }
        }
      }

      if (education) {
        if (education === 'Post Graduated') {
          baseSql += ` AND (last_education REGEXP 'MBA|Master|M\\\\.|PG|Post' OR qualification REGEXP 'MBA|Master|M\\\\.|PG|Post')`;
        } else if (education === 'Graduated') {
          baseSql += ` AND (last_education REGEXP 'B\\\\.|Bachelor|Degree|Grad|BTech|BCA|BBA' OR qualification REGEXP 'B\\\\.|Bachelor|Degree|Grad|BTech|BCA|BBA')`;
        } else if (education === 'Unknown') {
          baseSql += ` AND (COALESCE(last_education, qualification, '') = '')`;
        }
      }

      if (experienceRange) {
        if (experienceRange.includes('+')) {
          const min = parseInt(experienceRange);
          if (!isNaN(min)) {
            baseSql += ` AND CAST(total_experience AS UNSIGNED) >= ?`;
            params.push(min);
          }
        } else {
          const [mn, mx] = experienceRange.split('-').map(Number);
          if (!isNaN(mn) && !isNaN(mx)) {
            baseSql += ` AND CAST(total_experience AS UNSIGNED) >= ? AND CAST(total_experience AS UNSIGNED) <= ?`;
            params.push(mn, mx);
          }
        }
      }

      if (salaryRange) {
        if (salaryRange.includes('+')) {
          const min = parseInt(salaryRange);
          if (!isNaN(min)) {
            baseSql += ` AND (salary_text LIKE ? OR salary_text LIKE ?)`;
            params.push(`%${min}+%`, `%${min}.%`);
          }
        } else if (salaryRange.includes('-')) {
          const [mn, mx] = salaryRange.split('-').map(Number);
          if (!isNaN(mn) && !isNaN(mx)) {
            baseSql += ` AND (salary_text LIKE ? OR salary_text LIKE ?)`;
            params.push(`%${mn}%`, `%${mx}%`);
          }
        }
      }
    }

    const safeParams = params.map(p => p === undefined ? null : p);

    // Get total count
    const [countRows] = await db.query(`SELECT COUNT(*) as totalCount ${baseSql}`, safeParams);
    const totalCount = countRows[0].totalCount;

    // Build ORDER BY clause
    let orderBy = 'ORDER BY name ASC';
    const [field, dir0] = sort.split('_');
    const dir = dir0 ? dir0.toUpperCase() : 'ASC';
    
    if (field === 'salary') {
      orderBy = `ORDER BY COALESCE(annual_salary, 0) ${dir}, name ASC`;
    } else if (field === 'experience') {
      orderBy = `ORDER BY COALESCE(total_experience, 0) ${dir}, name ASC`;
    } else if (field === 'age') {
      orderBy = `ORDER BY COALESCE(age, 0) ${dir}, name ASC`;
    } else if (field === 'name') {
      orderBy = `ORDER BY name ${dir}`;
    }

    // Get paginated results - uses appropriate indexes
    const offset = (page - 1) * pageSize;
    const [results] = await db.query(
      `SELECT id, name, email, phone, current_location, designation, total_experience, last_education, salary_text, annual_salary, age, gender, company_name, industry, alphabet ${baseSql} ${orderBy} LIMIT ? OFFSET ?`,
      [...safeParams, pageSize, offset]
    );

    res.json({ results, totalCount });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: 'Search failed', error: err.message });
  }
});

// ==================================================
// 4. POST EXPORT
// ==================================================
router.post('/export', async (req, res) => {
  try {
    const body = req.body || {};
    const nameSearch = body.nameSearch ? body.nameSearch.trim() : null;
    const ageRange = body.ageRange || null;
    const education = body.education || null;
    const experienceRange = body.experienceRange || null;
    const salaryRange = body.salaryRange || null;
    const sort = body.sort || 'name_asc';

    const dept = toStr(body.department || '');
    const isBD = dept.toLowerCase().includes('business development');
    const isRecruitment = dept.toLowerCase().includes('recruitment');
    const isFranchise = dept.toLowerCase().includes('franchise');

    const toArr = (v) => v ? (Array.isArray(v) ? v.filter(Boolean) : [v].filter(Boolean)) : [];
    const locationArray = toArr(body.location);
    const genderArray = toArr(body.gender);
    const industryArray = toArr(body.industry);
    const companyArray = toArr(body.company);
    const designationArray = toArr(body.designation);

    const db = await connectDB();
    let baseSql = `FROM profiles WHERE 1=1`;
    let params = [];

    if (locationArray.length > 0) {
      baseSql += ` AND current_location IN (${locationArray.map(() => '?').join(',')})`;
      params.push(...locationArray);
    }

    if (genderArray.length > 0) {
      const hasBoth = genderArray.some(g => String(g).toLowerCase() === 'both');
      if (!hasBoth) {
        const hasNoData = genderArray.includes('No Data');
        const others = genderArray.filter(g => g !== 'No Data');

        if (hasNoData && others.length > 0) {
          baseSql += ` AND (gender IN (${others.map(() => '?').join(',')}) OR gender IS NULL OR TRIM(gender) = '')`;
          params.push(...others);
        } else if (hasNoData) {
          baseSql += ` AND (gender IS NULL OR TRIM(gender) = '')`;
        } else {
          baseSql += ` AND gender IN (${others.map(() => '?').join(',')})`;
          params.push(...others);
        }
      }
    }

    if (industryArray.length > 0) {
      baseSql += ` AND industry IN (${industryArray.map(() => '?').join(',')})`;
      params.push(...industryArray);
    }
    
    if (isBD && companyArray.length > 0) {
      const valid = companyArray.filter(c => c && c.trim());
      if (valid.length) {
        baseSql += ` AND company_name IN (${valid.map(() => '?').join(',')})`;
        params.push(...valid);
      }
    }
    
    if (designationArray.length > 0) {
      baseSql += ` AND designation IN (${designationArray.map(() => '?').join(',')})`;
      params.push(...designationArray);
    }

    if (ageRange) {
      if (ageRange.includes('+')) {
        const min = parseInt(ageRange);
        if (!isNaN(min)) {
          baseSql += ` AND age >= ?`;
          params.push(min);
        }
      } else {
        const [mn, mx] = ageRange.split('-').map(Number);
        if (!isNaN(mn) && !isNaN(mx)) {
          baseSql += ` AND age >= ? AND age <= ?`;
          params.push(mn, mx);
        }
      }
    }
    
    if (education) {
      if (education === 'Post Graduated') {
        baseSql += ` AND (last_education REGEXP 'MBA|Master|M\\\\.|PG|Post' OR qualification REGEXP 'MBA|Master|M\\\\.|PG|Post')`;
      } else if (education === 'Graduated') {
        baseSql += ` AND (last_education REGEXP 'B\\\\.|Bachelor|Degree|Grad|BTech|BCA|BBA' OR qualification REGEXP 'B\\\\.|Bachelor|Degree|Grad|BTech|BCA|BBA')`;
      } else if (education === 'Unknown') {
        baseSql += ` AND (COALESCE(last_education, qualification, '') = '')`;
      }
    }
    
    if (experienceRange) {
      if (experienceRange.includes('+')) {
        const min = parseInt(experienceRange);
        if (!isNaN(min)) {
          baseSql += ` AND CAST(total_experience AS UNSIGNED) >= ?`;
          params.push(min);
        }
      } else {
        const [mn, mx] = experienceRange.split('-').map(Number);
        if (!isNaN(mn) && !isNaN(mx)) {
          baseSql += ` AND CAST(total_experience AS UNSIGNED) >= ? AND CAST(total_experience AS UNSIGNED) <= ?`;
          params.push(mn, mx);
        }
      }
    }
    
    if (salaryRange) {
      if (salaryRange.includes('+')) {
        const min = parseInt(salaryRange);
        if (!isNaN(min)) {
          baseSql += ` AND (salary_text LIKE ? OR salary_text LIKE ?)`;
          params.push(`%${min}+%`, `%${min}.%`);
        }
      } else if (salaryRange.includes('-')) {
        const [mn, mx] = salaryRange.split('-').map(Number);
        if (!isNaN(mn) && !isNaN(mx)) {
          baseSql += ` AND (salary_text LIKE ? OR salary_text LIKE ?)`;
          params.push(`%${mn}%`, `%${mx}%`);
        }
      } else {
        baseSql += ` AND salary_text LIKE ?`;
        params.push(`%${salaryRange}%`);
      }
    }

  if (nameSearch) {
  baseSql += ` AND (name LIKE ? OR designation LIKE ? OR last_education LIKE ? OR company_name LIKE ? OR current_location LIKE ?)`;
  params.push(`%${nameSearch}%`, `%${nameSearch}%`, `%${nameSearch}%`, `%${nameSearch}%`, `%${nameSearch}%`);
}

    const safeParams = params.map(p => p === undefined ? null : p);

    let orderBy = 'ORDER BY name ASC';
    const [field, dir0] = sort.split('_');
    const dir = dir0 ? dir0.toUpperCase() : 'ASC';
    
    if (field === 'salary') {
      orderBy = `ORDER BY COALESCE(annual_salary, 0) ${dir}, name ASC`;
    } else if (field === 'experience') {
      orderBy = `ORDER BY COALESCE(total_experience, 0) ${dir}, name ASC`;
    } else if (field === 'age') {
      orderBy = `ORDER BY COALESCE(age, 0) ${dir}, name ASC`;
    }

    let query;
    if (isBD) {
      query = `SELECT profiles.id, profiles.name, profiles.email, profiles.phone, profiles.current_location,
        profiles.designation, profiles.industry, profiles.total_experience, profiles.annual_salary,
        profiles.salary_text, profiles.age, profiles.gender, profiles.last_education, profiles.company_name,
        profiles.notice_period, profiles.previous_employer, profiles.key_skills, profiles.created_at,
        (SELECT pv.user_name FROM profile_views pv WHERE pv.profile_id=profiles.id ORDER BY pv.viewed_at DESC LIMIT 1) as viewed_by,
        (SELECT DATE(pv.viewed_at) FROM profile_views pv WHERE pv.profile_id=profiles.id ORDER BY pv.viewed_at DESC LIMIT 1) as viewed_at,
        (SELECT COUNT(*) FROM profile_views pv WHERE pv.profile_id=profiles.id) as total_views
        ${baseSql} ${orderBy}`;
    } else {
      query = `SELECT profiles.id, profiles.name, profiles.email, profiles.phone, profiles.current_location,
        profiles.designation, profiles.industry, profiles.total_experience, profiles.annual_salary,
        profiles.salary_text, profiles.age, profiles.gender, profiles.last_education, profiles.company_name,
        profiles.notice_period, profiles.previous_employer, profiles.key_skills, profiles.created_at
        ${baseSql} ${orderBy}`;
    }

    const [results] = await db.query(query, safeParams);

    const XLSX = (await import('xlsx')).default;

    const baseRow = row => ({
      'Name': row.name || '', 'Email': row.email || '', 'Phone': row.phone || '',
      'Location': row.current_location || '', 'Designation': row.designation || '',
      'Industry': row.industry || '', 'Experience': row.total_experience ? `${row.total_experience} Yrs` : '',
      'Annual Salary': row.annual_salary || row.salary_text || '', 'Age': row.age || '',
      'Gender': row.gender || '', 'Education': row.last_education || '',
      'Current Company': row.company_name || '', 'Notice Period': row.notice_period || '',
      'Previous Employer': row.previous_employer || '', 'Key Skills': row.key_skills || '',
      'Added Date': row.created_at ? new Date(row.created_at).toLocaleDateString() : ''
    });

    const exportData = isBD
      ? results.map(row => ({ ...baseRow(row), 'Viewed By': row.viewed_by || '', 'Viewed At': row.viewed_at ? new Date(row.viewed_at).toLocaleDateString() : '', 'Total Views': row.total_views || 0 }))
      : results.map(row => baseRow(row));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    const sheetName = isBD ? 'BD_Candidates' : isRecruitment ? 'Recruitment_Candidates' : isFranchise ? 'Franchise_Candidates' : 'Candidates';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=candidates_${dept.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(excelBuffer);

  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ message: 'Export failed', error: err.message });
  }
});

export default router;