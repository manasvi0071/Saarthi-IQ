import { validateApiKey } from '../middleware/apiKeyAuth.js';
import express from 'express';
import { connectDB } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Update the PUT /update-name route in profiles.js
router.put('/update-name', requireAuth, async (req, res) => {
  try {
    const { profile_id, name } = req.body;
    const currentUserId = req.user.id;
    
    if (!profile_id || !name) {
      return res.status(400).json({
        success: false,
        message: 'profile_id and name are required'
      });
    }
    
    const db = await connectDB();
    
    // Get current name and department
    const [profileRows] = await db.execute(
      'SELECT name, department FROM profiles WHERE id = ?',
      [profile_id]
    );
    
    if (profileRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    
    const oldName = profileRows[0].name || 'Unknown';
    const currentDepartment = profileRows[0].department || 'General';
    
    // Calculate alphabet from new name
    const newAlphabet = name.trim().charAt(0).toUpperCase();
    
    // Update name and alphabet, keep existing department
    await db.execute(
      `UPDATE profiles 
       SET name = ?,
           alphabet = ?,
           updated_at = NOW(),
           department = COALESCE(?, department)  -- Keep existing department if not provided
       WHERE id = ?`,
      [name, newAlphabet, currentDepartment, profile_id]
    );
    
    // Log the change in activity logs
    const note = `Candidate name updated: "${oldName}" → "${name}"`;
    
    try {
      await db.execute(
        `INSERT INTO activity_logs 
         (user_id, profile_id, department, status, duration, note, candidate_location) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [currentUserId, profile_id, 'System', 'in-progress', '00:00:00', note, 'N/A']
      );
    } catch (logError) {
      console.error('Error logging name change:', logError);
      // Continue even if logging fails
    }
    
    res.json({
      success: true,
      message: 'Name updated successfully',
      data: { 
        old_name: oldName, 
        new_name: name,
        alphabet: newAlphabet
      }
    });
    
  } catch (error) {
    console.error('Error updating name:', error);
    
    // Provide more specific error message
    let errorMessage = 'Failed to update name';
    if (error.code === 'ER_DATA_TOO_LONG') {
      errorMessage = 'Data too long for one of the fields. Please check field lengths.';
    } else if (error.code === 'ER_TRUNCATED_WRONG_VALUE') {
      errorMessage = 'Invalid data format. Please check the values being updated.';
    }
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add to profiles.js - Simple direct name update without activity logging
router.post('/simple-name-update', requireAuth, async (req, res) => {
  try {
    const { profile_id, name } = req.body;
    
    console.log('📝 Simple name update request:', { profile_id, name });
    
    if (!profile_id || !name) {
      return res.status(400).json({
        success: false,
        message: 'profile_id and name are required'
      });
    }
    
    const db = await connectDB();
    
    // Get current name
    const [profileRows] = await db.execute(
      'SELECT name FROM profiles WHERE id = ?',
      [profile_id]
    );
    
    if (profileRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Profile not found' 
      });
    }
    
    const oldName = profileRows[0].name || 'Unknown';
    
    // Calculate new alphabet
    const newAlphabet = name.trim().charAt(0).toUpperCase();
    
    // Simple update query
    const [result] = await db.execute(
      `UPDATE profiles 
       SET name = ?,
           candidate_name = ?,
           alphabet = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [name, name, newAlphabet, profile_id]
    );
    
    console.log('✅ Simple name update successful:', {
      affectedRows: result.affectedRows,
      oldName,
      newName: name
    });
    
    res.json({
      success: true,
      message: 'Name updated successfully',
      data: {
        old_name: oldName,
        new_name: name,
        alphabet: newAlphabet
      }
    });
    
  } catch (error) {
    console.error('❌ Simple name update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update name',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
router.get('/public/list', validateApiKey, async (req, res) => {
  try {
    const [profiles] = await pool.execute(
      `SELECT id, name, email, location, phone, department 
       FROM profiles 
       LIMIT 100`
    );

    res.json({
      success: true,
      data: profiles,
      requestedBy: `API Key: ${req.apiKey.key_prefix}`,
      message: 'Data fetched successfully',
      totalCount: profiles.length
    });

  } catch (error) {
    console.error('Fetch profiles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profiles'
    });
  }
});
/**
 * ✅ GET CANDIDATES BY POSITION (Protected with API Key)
 * GET /api/profiles/by-position/:position
 * Query: ?department=BD&limit=100&offset=0&search=name
 * Requires: Authorization: Bearer sk_xxxx
 */
router.get('/by-position/:position', validateApiKey, async (req, res) => {
  try {
    const { position } = req.params;
    const { department, limit = 50, offset = 0, search } = req.query;
    
    console.log(`🔍 Searching candidates for position: ${position}`);

    if (!position) {
      return res.status(400).json({
        success: false,
        message: 'Position parameter is required'
      });
    }

    let query = `
      SELECT 
        id,
        name,
        email,
        phone,
        location,
        department,
        candidate_name,
        skills,
        experience,
        education,
        current_company,
        current_position,
        created_at,
        updated_at
      FROM profiles 
      WHERE 1=1
    `;
    
    const params = [];

    // Filter by position (case-insensitive)
    query += ` AND (current_position LIKE ? OR skills LIKE ?)`;
    params.push(`%${position}%`, `%${position}%`);

    // Filter by department (optional)
    if (department) {
      query += ` AND department = ?`;
      params.push(department);
    }

    // Search by name (optional)
    if (search) {
      query += ` AND (name LIKE ? OR candidate_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [profiles] = await pool.execute(query, params);

    // Count total records
    let countQuery = `SELECT COUNT(*) as total FROM profiles WHERE 1=1`;
    const countParams = [];

    if (position) {
      countQuery += ` AND (current_position LIKE ? OR skills LIKE ?)`;
      countParams.push(`%${position}%`, `%${position}%`);
    }

    if (department) {
      countQuery += ` AND department = ?`;
      countParams.push(department);
    }

    if (search) {
      countQuery += ` AND (name LIKE ? OR candidate_name LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    console.log(`✅ Found ${profiles.length} candidates for position: ${position}`);

    res.json({
      success: true,
      data: profiles.map(p => ({
        id: p.id,
        name: p.name || p.candidate_name,
        email: p.email,
        phone: p.phone,
        location: p.location,
        department: p.department,
        currentPosition: p.current_position,
        skills: p.skills,
        experience: p.experience,
        education: p.education,
        currentCompany: p.current_company,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / parseInt(limit))
      },
      position: position,
      message: `Found ${profiles.length} candidates matching position "${position}"`
    });

  } catch (error) {
    console.error('Search candidates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search candidates',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
export default router;