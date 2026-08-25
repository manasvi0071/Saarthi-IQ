import express from 'express';
import { connectDB } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/* =========================
   Helper Functions
========================= */

// Safe string cleaner (FIXES YOUR 500 ERROR)
const safe = (val) => {
  if (val === undefined || val === null) return '';
  return String(val).trim();
};

// Add time durations
const addTimes = (time1, time2) => {
  if (!time1 || time1 === '00:00:00') return time2 || '00:00:00';
  if (!time2 || time2 === '00:00:00') return time1 || '00:00:00';

  try {
    const [h1, m1, s1] = time1.split(':').map(Number);
    const [h2, m2, s2] = time2.split(':').map(Number);

    let seconds = s1 + s2;
    let minutes = m1 + m2 + Math.floor(seconds / 60);
    let hours = h1 + h2 + Math.floor(minutes / 60);

    seconds %= 60;
    minutes %= 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } catch {
    return '00:00:00';
  }
};

/* =========================
   UPDATE CANDIDATE DETAILS
========================= */

router.put('/update-candidate-details', requireAuth, async (req, res) => {
  try {
    const {
      profile_id,
      name,
      phone,
      email,
      location,
      education,
      company,
      designation,
      experience,
      annual_salary,
      notice_period,
      previous_employer,
      key_skills
    } = req.body;

    const userId = req.user.id;

    if (!profile_id) {
      return res.status(400).json({
        success: false,
        message: 'profile_id is required'
      });
    }

    const db = await connectDB();

    /* =========================
       Fetch Existing Profile
    ========================= */
    const [rows] = await db.execute(
      `SELECT name, phone, email, current_location 
       FROM profiles WHERE id = ?`,
      [profile_id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    const old = rows[0];

    /* =========================
       Build Dynamic Update
    ========================= */
    const updates = [];
    const params = [];

    if (safe(name)) {
      updates.push('name = ?', 'candidate_name = ?', 'alphabet = ?');
      params.push(safe(name), safe(name), safe(name).charAt(0).toUpperCase());
    }

    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(safe(phone));
    }

    if (email !== undefined) {
      updates.push('email = ?');
      params.push(safe(email));
    }

    if (location !== undefined) {
      updates.push('current_location = ?');
      params.push(safe(location));
    }

    if (education !== undefined) {
      updates.push('last_education = ?');
      params.push(safe(education));
    }

    if (company !== undefined) {
      updates.push('company_name = ?');
      params.push(safe(company));
    }

    if (designation !== undefined) {
      updates.push('designation = ?');
      params.push(safe(designation));
    }

    if (experience !== undefined) {

  let expVal = safe(experience);

  if (expVal === '') {
    expVal = null;
  } else if (!isNaN(expVal)) {
    expVal = parseFloat(expVal);
  } else {
    const match = expVal.match(/[\d.]+/);
    expVal = match ? parseFloat(match[0]) : null;
  }

  updates.push('total_experience = ?');
  params.push(expVal);
}

    if (annual_salary !== undefined && annual_salary !== null) {
  const salaryText = safe(annual_salary);

  // Extract numeric value (e.g., "Rs 6.0 Lakhs" → 600000)
  let numericSalary = null;

  const match = salaryText.match(/([\d.]+)/);
  if (match) {
    const value = parseFloat(match[1]);

    if (salaryText.toLowerCase().includes('lakh')) {
      numericSalary = Math.round(value * 100000);
    } else if (salaryText.toLowerCase().includes('crore')) {
      numericSalary = Math.round(value * 10000000);
    } else {
      numericSalary = Math.round(value);
    }
  }

  updates.push('annual_salary = ?', 'salary_text = ?');
  params.push(numericSalary || 0, salaryText);
}

    if (notice_period !== undefined) {
      updates.push('notice_period = ?');
      params.push(safe(notice_period));
    }

    if (previous_employer !== undefined) {
      updates.push('previous_employer = ?');
      params.push(safe(previous_employer));
    }

    if (key_skills !== undefined) {
      updates.push('key_skills = ?');
      params.push(safe(key_skills));
    }

    updates.push('updated_at = NOW()');

    if (updates.length > 0) {
      params.push(profile_id);

      const query = `UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`;
      await db.execute(query, params);
    }

   /* =========================
   Activity Log (UPDATED STATUS FIX)
========================= */

const note = 'Candidate details updated';

try {
  const [userRows] = await db.execute(
    'SELECT department FROM users WHERE id = ?',
    [userId]
  );

  const dept = userRows[0]?.department || 'Admin';

  const deptMap = {
    'Business Development': 'BD',
    'Recruitment': 'Recruit',
    'Franchise': 'Franchise',
    'Admin': 'Admin'
  };

  const activityDepartment = deptMap[dept] || 'Admin';

  // ✅ CHECK if activity already exists
  const [existing] = await db.execute(
    `SELECT id FROM activity_logs 
     WHERE profile_id = ? AND user_id = ?
     ORDER BY id DESC LIMIT 1`,
    [profile_id, userId]
  );

  if (existing.length > 0) {
    // ✅ UPDATE existing activity
    await db.execute(
      `UPDATE activity_logs
       SET status = ?, note = ?, candidate_location = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        'updated',   // ✅ FIXED STATUS
        note,
        safe(location) || old.current_location,
        existing[0].id
      ]
    );
  } else {
    // ✅ INSERT new activity
    await db.execute(
      `INSERT INTO activity_logs
       (user_id, profile_id, department, status, duration, note, candidate_location)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        profile_id,
        activityDepartment,
        'updated',   // ✅ FIXED STATUS
        '00:00:00',
        note,
        safe(location) || old.current_location
      ]
    );
  }

} catch (err) {
  console.log('Activity log skipped:', err.message);
}

    /* =========================
       Return Updated Data
    ========================= */
    const [updated] = await db.execute(
      `SELECT id, name, candidate_name, phone, email, current_location,
              last_education as education, company_name, designation,
              total_experience, annual_salary, notice_period,
              previous_employer, key_skills
       FROM profiles WHERE id = ?`,
      [profile_id]
    );

    return res.json({
      success: true,
      message: 'Candidate details updated successfully',
      data: updated[0]
    });

  } catch (error) {
    console.error('❌ ERROR:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update candidate details',
      error: error.message
    });
  }
});

/* =========================
   GET Candidate Details
========================= */

router.get('/candidate-details/:profile_id', requireAuth, async (req, res) => {
  try {
    const { profile_id } = req.params;
    const db = await connectDB();

    const [rows] = await db.execute(
      `SELECT * FROM profiles WHERE id = ?`,
      [profile_id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching details'
    });
  }
});

/* =========================
   ADD ACTIVITY
========================= */

router.post('/', requireAuth, async (req, res) => {
  try {
    const { profile_id, department, status, duration, note, candidate_location } = req.body;
    const userId = req.user.id;

    const allowedDepartments = ['BD', 'Recruit', 'Franchise', 'Admin'];
    const allowedStatuses = [
      'in-progress',
      'cancelled',
      'closed',
      'follow-up',
      'updated'
    ];

    const safeProfileId = safe(profile_id);
    const safeDepartment = safe(department);
    const safeStatus = safe(status).toLowerCase();
    const safeDuration = safe(duration) || '00:00:00';
    const safeNote = safe(note);
    const safeLocation = safe(candidate_location);

    if (!safeProfileId || !safeDepartment) {
      return res.status(400).json({
        success: false,
        message: 'profile_id and department required'
      });
    }

    if (!allowedDepartments.includes(safeDepartment)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department'
      });
    }

    if (!allowedStatuses.includes(safeStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status: ${safeStatus}`
      });
    }

    const db = await connectDB();

    const [result] = await db.execute(
      `INSERT INTO activity_logs
       (user_id, profile_id, department, status, duration, note, candidate_location)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        safeProfileId,
        safeDepartment,
        safeStatus,
        safeDuration,
        safeNote || null,
        safeLocation || null
      ]
    );

    res.json({
      success: true,
      message: 'Activity saved',
      id: result.insertId
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* =========================
   GET ACTIVITIES
========================= */

router.get('/:profile_id', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();

    const [rows] = await db.execute(
      `SELECT * FROM activity_logs WHERE profile_id = ? ORDER BY created_at DESC`,
      [req.params.profile_id]
    );

    res.json({ success: true, data: rows });

  } catch {
    res.status(500).json({ success: false });
  }
});

/* =========================
   DELETE ACTIVITY
========================= */

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    await db.execute('DELETE FROM activity_logs WHERE id = ?', [req.params.id]);

    res.json({ success: true });

  } catch {
    res.status(500).json({ success: false });
  }
});

/* ========================= */

export default router;
