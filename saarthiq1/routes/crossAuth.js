/**
 * routes/crossAuth.js  —  SarthiIQ backend
 *
 * GET /api/cross-auth?token=<xtoken>
 *
 * Validates the JWT minted by Sarthi360, looks up the user,
 * and returns a real SarthiIQ session token with the exact same
 * payload/response shape as completeLogin() in auth.js.
 *
 * Place this file in:  backend/routes/crossAuth.js
 *
 * Register in server.js:
 *   import crossAuthRouter from './routes/crossAuth.js';
 *   app.use('/api/cross-auth', crossAuthRouter);
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { connectDB } from '../db.js';   // ← same import as auth.js

const router = express.Router();

// GET /api/cross-auth?token=xxx
router.get('/', async (req, res) => {
  const { token: xtoken } = req.query;

  if (!xtoken) {
    return res.status(400).json({ error: 'Missing token' });
  }

  // ── 1. Verify the cross-app token from Sarthi360 ──────────────────────────
  let payload;
  try {
    payload = jwt.verify(xtoken, process.env.CROSS_APP_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { email, department, userName } = payload;

  // ── 2. Look up the user — same pattern as auth.js uses throughout ─────────
  try {
    const db = await connectDB();

    const [rows] = await db.query(
      `SELECT 
        id, name, email, phone, department,
        is_admin, employee_id, can_edit_profile
       FROM users
       WHERE email = ? AND is_approved = 1 AND is_blocked = 0
       LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found or not approved' });
    }

    const user = rows[0];

    // ── 3. Build JWT payload — identical to completeLogin() in auth.js ───────
    const actualDepartment = user.department;
    const reportDepartment = actualDepartment === 'Admin'
      ? 'Business Development'
      : actualDepartment;

    const jwtPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      is_admin: user.is_admin,
      department: reportDepartment,
      employee_id: user.employee_id,
      actual_department: actualDepartment,
      connectionId: null,   // no socket connection for cross-auth
    };

    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
      expiresIn: '7d',      // matches CONFIG.JWT_EXPIRY in auth.js
    });

    // ── 4. Return the exact same shape as completeLogin() ────────────────────
    // AdvancedFilterPage.jsx stores each of these in localStorage.
    return res.json({
      success: true,
      token,
      name: user.name,
      email: user.email,
      phone: user.phone,
      department: reportDepartment,
      is_admin: user.is_admin,
      employee_id: user.employee_id,
      userId: user.id,
      canEditProfile: user.can_edit_profile,
      connectionId: null,

      // Convenience fields read by getOrCreateUserInfo() in AdvancedFilterPage
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: reportDepartment,
        is_admin: user.is_admin,
        employee_id: user.employee_id,
      },
      userName: user.name,
    });

  } catch (err) {
    console.error('❌ crossAuth error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;