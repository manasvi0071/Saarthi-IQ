// backend/routes/users.js - COMPLETE UPDATED VERSION WITH APPROVAL EMAIL
import express from 'express';
import { connectDB } from '../db.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { Resend } from 'resend';

const router = express.Router();

// ============ SIMPLE RESEND CONFIGURATION ============
let resendClient = null;
try {
  if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend email service initialized in users.js');
  } else {
    console.warn('❌ RESEND_API_KEY not configured - approval emails will not be sent');
  }
} catch (error) {
  console.error('❌ Failed to initialize Resend in users.js:', error.message);
}

// Email counter for rate limiting
let emailCount = 0;
const EMAIL_LIMIT_PER_DAY = 100;

// Reset email counter daily at midnight
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    console.log(`🔄 Resetting daily email counter in users.js (was: ${emailCount})`);
    emailCount = 0;
  }
}, 60000); // Check every minute

/**
 * Send registration approval email to user
 */
async function sendApprovalEmail(to, name, employeeId, department) {
  // Check daily limit
  if (emailCount >= EMAIL_LIMIT_PER_DAY) {
    console.warn(`⚠️ Daily email limit reached. Skipping approval email to: ${to}`);
    return false;
  }
  
  // If no Resend client, skip sending
  if (!resendClient) {
    console.warn(`📧 Resend not configured. Skipping approval email to: ${to}`);
    return false;
  }

  try {
    console.log(`📧 Sending registration approval email to: ${to} (Count: ${emailCount + 1}/${EMAIL_LIMIT_PER_DAY})`);
    
    // HTML Email Template
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registration Approved - Welcome to Talent Corner</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; margin: 0 0 30px 0;">
            <h1 style="color: white; margin: 0 0 10px 0; font-size: 28px; font-weight: 600;">Registration Approved!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px;">Welcome to Talent Corner</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="background-color: #d1fae5; width: 100px; height: 100px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <svg style="width: 50px; height: 50px; color: #10b981;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h2 style="color: #065f46; margin: 0 0 15px 0;">Welcome, ${name}!</h2>
              <p style="color: #6b7280; font-size: 18px;">Your account has been approved by the administrator.</p>
            </div>
            
            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 6px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
              <h3 style="color: #1e40af; margin-top: 0;">Welcome to SaarthIQ!</h3>
              <p style="color: #374151; line-height: 1.6;">
                SaarthIQ is designed to make your workflow smoother, faster, and more efficient. 
                It provides quick and reliable access to resumes and candidate information, 
                ensuring you have the right data at the right time. 
                By reducing repeated sourcing, it helps avoid unnecessary time and cost spent on data collection. 
                SaarthIQ adds real value to your day-to-day operations and supports better outcomes for clients.
              </p>
            </div>
            
            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 6px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
              <h3 style="color: #1e40af; margin-top: 0; margin-bottom: 15px;">Your Account Details:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Name:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Email:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${to}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Employee ID:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong style="color: #1d4ed8; font-size: 18px;">${employeeId}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>Department:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${department}</td>
                </tr>
                <tr>
                  <td style="padding: 10px;"><strong>Status:</strong></td>
                  <td style="padding: 10px;"><span style="background-color: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 20px; font-weight: bold;">ACTIVE</span></td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #ecfdf5; padding: 20px; border-radius: 6px; border-left: 4px solid #10b981; margin-bottom: 25px;">
              <h3 style="color: #065f46; margin-top: 0;">Getting Started:</h3>
              <ol style="margin-bottom: 0;">
                <li style="margin-bottom: 8px;">Use your registered email and password to log in</li>
                <li style="margin-bottom: 8px;">You'll be prompted to set up two-factor authentication on first login</li>
                <li>Start exploring SaarthIQ to streamline your recruitment workflow</li>
              </ol>
            </div>
            
            <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 5px 0; color: #9ca3af; font-size: 12px;">
                <strong>Talent Corner H.R. Services Pvt. Ltd.</strong><br>
                Welcome to our team!
              </p>
              <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 11px;">
                This is an automated notification, please do not reply.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Plain text version
    const plainTextContent = `Registration Approved!

Dear ${name},

Your Talent Corner account has been approved!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Welcome to SaarthIQ!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SaarthIQ is designed to make your workflow smoother, faster, and more efficient. 
It provides quick and reliable access to resumes and candidate information, 
ensuring you have the right data at the right time. 
By reducing repeated sourcing, it helps avoid unnecessary time and cost spent on data collection. 
SaarthIQ adds real value to your day-to-day operations and supports better outcomes for clients.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your Account Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${name}
Email: ${to}
Employee ID: ${employeeId}
Department: ${department}
Status: ACTIVE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Getting Started:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Use your registered email and password to log in
2. You'll be prompted to set up two-factor authentication on first login
3. Start exploring SaarthIQ to streamline your recruitment workflow

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Talent Corner H.R. Services Pvt. Ltd.
Welcome to our team!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const response = await resendClient.emails.send({
      from: 'Talent Corner <team@saarthiq.in>',
      to,
      subject: 'Talent Corner - Registration Approved - Welcome to SaarthIQ!',
      html: htmlContent,
      text: plainTextContent
    });

    if (response.error) {
      console.error(`❌ Resend error for ${to}:`, response.error);
      return false;
    }

    emailCount++;
    console.log(`✅ Registration approval email sent to ${to}, ID: ${response.data?.id}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Email sending error for ${to}:`, error.message);
    return false;
  }
}

/* =======================
   HELPER: Create notification
======================= */
const createNotification = async (db, type, title, userId, sourceData = {}) => {
  try {
    await db.execute(
      `INSERT INTO notifications (type, title, user_id, data, \`read\`, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [type, title, userId, JSON.stringify(sourceData), 0, new Date()]
    );
    return true;
  } catch (error) {
    console.error('❌ Create notification error:', error);
    return false;
  }
};

/* =======================
   HELPER: Notify all admins
======================= */
const notifyAllAdmins = async (db, io, type, title, sourceData = {}) => {
  try {
    const [admins] = await db.execute('SELECT id FROM users WHERE is_admin = 1');
    
    for (const admin of admins) {
      await createNotification(db, type, title, admin.id, sourceData);
    }
    
    if (io) {
      io.emit('newNotification', { type, title, sourceData });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Notify admins error:', error);
    return false;
  }
};

/* =======================
   GET ALL USERS (INCLUDING DISABLED)
======================= */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const db = await connectDB();
    
    const [users] = await db.execute(`
      SELECT 
        u.id,
        u.employee_id,
        u.name,
        u.email,
        u.phone,
        u.department,
        u.is_admin,
        u.can_edit_profile,
        u.is_approved,
        u.is_locked,
        u.is_blocked,
        u.is_enabled,
        u.email_automation_enabled,
        u.enabled_until,
        u.disabled_at,
        u.disabled_by,
        u.disabled_reason,
        u.locked_at,
        u.last_login,
        u.login_attempts,
        u.created_at
      FROM users u
      ORDER BY 
        CASE 
          WHEN u.is_enabled = 0 THEN 1
          WHEN u.is_locked = 1 OR u.is_blocked = 1 THEN 2
          ELSE 3
        END,
        u.created_at DESC
    `);
    
    // Get global email automation setting
    const [settingsRows] = await db.execute(
      'SELECT setting_key, setting_value FROM system_settings'
    );
    
    // Find emailAutomation setting
    let globalEmailAutomation = true; // default to true
    for (const row of settingsRows) {
      if (row.setting_key === 'emailAutomation') {
        globalEmailAutomation = row.setting_value === 'true' || row.setting_value === '1';
        break;
      }
    }
    
    // Apply global override to users with special exception
    const usersWithOverride = users.map(user => {
      const SPECIAL_USER_EMAIL = "ailsneha1105@gmail.com";
      
      // ⭐ SPECIAL USER: Always enable email automation for this user
      let effectiveEmailAutomation;
      
      if (user.email === SPECIAL_USER_EMAIL) {
        effectiveEmailAutomation = true;
        console.log(`✅ SPECIAL ACCESS: Email automation always enabled for ${SPECIAL_USER_EMAIL}`);
      } else {
        effectiveEmailAutomation = globalEmailAutomation 
          ? user.email_automation_enabled 
          : false;
      }
      
      return {
        ...user,
        effective_email_automation: effectiveEmailAutomation
      };
    });
    
    // Get pending users separately
    const [pendingUsers] = await db.execute(`
      SELECT 
        id, name, email, phone, department, ip_address, created_at
      FROM pending_users 
      ORDER BY created_at DESC
    `);
    
    res.json({
      success: true,
      users: usersWithOverride,
      pendingUsers: pendingUsers,
      counts: {
        total: usersWithOverride.length,
        active: usersWithOverride.filter(u => u.is_enabled === 1 && u.is_locked === 0 && u.is_blocked === 0).length,
        disabled: usersWithOverride.filter(u => u.is_enabled === 0).length,
        locked: usersWithOverride.filter(u => u.is_locked === 1 || u.is_blocked === 1).length,
        pending: pendingUsers.length
      },
      globalEmailAutomation: globalEmailAutomation
    });

  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

/* =======================
   UPDATE USER DETAILS
======================= */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, phone, department, is_admin, email_automation_enabled } = req.body;
    const db = await connectDB();
    
    // Check if user exists
    const [existingUser] = await db.execute(
      'SELECT id, email, is_admin FROM users WHERE id = ?',
      [userId]
    );
    
    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = existingUser[0];
    
    // Check if trying to edit self's admin status
    const currentAdminId = req.user.id;
    if (userId == currentAdminId && is_admin === false) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove admin status from yourself'
      });
    }
    
    // Build update query
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    
    if (department !== undefined) {
      updates.push('department = ?');
      values.push(department);
    }
    
    if (is_admin !== undefined) {
      updates.push('is_admin = ?');
      values.push(is_admin ? 1 : 0);
    }
    
    if (email_automation_enabled !== undefined) {
      updates.push('email_automation_enabled = ?');
      values.push(email_automation_enabled ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    // Add user ID to values
    values.push(userId);
    
    // Execute update
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    await db.execute(query, values);
    
    // Create notification for the user if their details were changed
    if (userId != currentAdminId) {
      await createNotification(db, 'profile_updated', 'Your Profile Was Updated', userId, {
        updatedBy: req.user.email,
        updatedFields: updates.map(u => u.split(' = ')[0]),
        timestamp: new Date().toISOString()
      });
      
      // Notify admins
      const io = req.app.get('io');
      await notifyAllAdmins(db, io, 'profile_updated_by_admin', 'User Profile Updated', {
        userId: userId,
        userEmail: user.email,
        userName: name || user.name,
        updatedBy: req.user.email,
        updatedFields: updates.map(u => u.split(' = ')[0])
      });
    }
    
    res.json({
      success: true,
      message: 'User updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
});

/* =======================
   TOGGLE EMAIL AUTOMATION FOR USER
======================= */
router.put('/:id/toggle-email-automation', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email_automation_enabled } = req.body;
    const db = await connectDB();
    
    if (email_automation_enabled === undefined) {
      return res.status(400).json({
        success: false,
        message: 'email_automation_enabled field is required'
      });
    }
    
    // Get user info
    const [userRows] = await db.execute(
      'SELECT id, name, email, email_automation_enabled FROM users WHERE id = ?',
      [id]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userRows[0];
    const newStatus = email_automation_enabled ? 1 : 0;
    
    // Update email automation setting
    await db.execute(
      'UPDATE users SET email_automation_enabled = ? WHERE id = ?',
      [newStatus, id]
    );
    
    // Create notification for the user
    await createNotification(db, 'email_automation_changed', 
      newStatus === 1 ? 'Email Automation Enabled' : 'Email Automation Disabled', 
      id, {
      action: newStatus === 1 ? 'enabled' : 'disabled',
      changedBy: req.user.email,
      timestamp: new Date().toISOString()
    });
    
    // Notify admins
    const io = req.app.get('io');
    await notifyAllAdmins(db, io, 'email_automation_changed', 'Email Automation Changed', {
      userId: id,
      userName: user.name,
      userEmail: user.email,
      newStatus: newStatus === 1 ? 'enabled' : 'disabled',
      changedBy: req.user.email,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: newStatus === 1 
        ? 'Email automation enabled for user'
        : 'Email automation disabled for user',
      email_automation_enabled: newStatus
    });
    
  } catch (error) {
    console.error('❌ Toggle email automation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle email automation'
    });
  }
});

/* =======================
   ENABLE USER ACCOUNT
======================= */
router.post('/enable-user', requireAdmin, async (req, res) => {
  try {
    const { userId, email, reason, actionBy } = req.body;
    const db = await connectDB();
    
    if (!userId && !email) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID or email is required' 
      });
    }
    
    // Get user info
    const query = userId 
      ? 'SELECT id, name, email, employee_id, department, is_enabled FROM users WHERE id = ?'
      : 'SELECT id, name, email, employee_id, department, is_enabled FROM users WHERE email = ?';
    
    const [userInfo] = await db.execute(query, [userId || email]);
    
    if (userInfo.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    const user = userInfo[0];
    
    // Check if user is already enabled
    if (user.is_enabled === 1) {
      return res.status(400).json({ 
        success: false,
        message: 'User is already enabled'
      });
    }
    
    // Enable the user
    await db.execute(
      'UPDATE users SET is_enabled = 1, enabled_until = NULL, disabled_at = NULL, disabled_by = NULL, disabled_reason = NULL WHERE id = ?',
      [user.id]
    );
    
    // Create notification for the user
    await createNotification(db, 'account_enabled', 'Account Enabled', user.id, {
      enabledBy: actionBy || req.user.email,
      reason: reason || 'Enabled by administrator',
      timestamp: new Date().toISOString()
    });
    
    // Send real-time notification to user
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${user.id}`).emit('accountEnabled', {
        enabledBy: actionBy || req.user.email,
        timestamp: new Date().toISOString()
      });
    }
    
    // Notify admins
    await notifyAllAdmins(db, io, 'account_enabled', 'Account Enabled', {
      userId: user.id,
      email: user.email,
      name: user.name,
      employeeId: user.employee_id,
      department: user.department,
      enabledBy: actionBy || req.user.email,
      action: 'enabled'
    });
    
    res.json({
      success: true,
      message: 'User account enabled successfully'
    });
    
  } catch (error) {
    console.error('❌ Enable user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enable user account'
    });
  }
});

/* =======================
   DISABLE USER ACCOUNT - IMPROVED WITH BETTER ERROR HANDLING
======================= */
router.post('/disable-user', requireAdmin, async (req, res) => {
  let db;
  try {
    const { userId, email, duration, enabledUntil, reason, actionBy } = req.body;
    db = await connectDB();
    
    if (!userId && !email) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID or email is required' 
      });
    }
    
    // Get user info
    const query = userId 
      ? 'SELECT id, name, email, employee_id, department, is_admin, is_enabled FROM users WHERE id = ?'
      : 'SELECT id, name, email, employee_id, department, is_admin, is_enabled FROM users WHERE email = ?';
    
    const [userInfo] = await db.execute(query, [userId || email]);
    
    if (userInfo.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    const user = userInfo[0];
    
    // Check if trying to disable self
    if (user.id === req.user.id) {
      return res.status(400).json({ 
        success: false,
        message: 'Cannot disable your own account' 
      });
    }
    
    // Check if user is admin
    if (user.is_admin === 1) {
      return res.status(400).json({ 
        success: false,
        message: 'Cannot disable admin accounts' 
      });
    }
    
    // Check if user is already disabled
    if (user.is_enabled === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'User is already disabled'
      });
    }
    
    // Calculate enabled_until date
    let enabledUntilDate = null;
    
    if (duration === 'custom' && enabledUntil) {
      enabledUntilDate = new Date(enabledUntil);
    } else if (duration === '1day') {
      enabledUntilDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else if (duration === '7days') {
      enabledUntilDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } else if (duration === '30days') {
      enabledUntilDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    
    // Disable the user account
    await db.execute(
      'UPDATE users SET is_enabled = 0, enabled_until = ?, disabled_at = ?, disabled_by = ?, disabled_by_email = ?, disabled_reason = ? WHERE id = ?',
      [
        enabledUntilDate,
        new Date(),
        req.user.id,
        actionBy || req.user.email,
        reason || 'Disabled by administrator',
        user.id
      ]
    );
    
    // Create notification for the user
    try {
      await createNotification(db, 'account_disabled', 'Account Disabled', user.id, {
        disabledBy: actionBy || req.user.email,
        reason: reason || 'Disabled by administrator',
        enabledUntil: enabledUntilDate,
        duration: duration || 'permanent',
        timestamp: new Date().toISOString()
      });
    } catch (notificationError) {
      console.error('⚠️ Notification creation failed (non-critical):', notificationError);
    }
    
    // Send real-time notification
    const io = req.app.get('io');
    if (io) {
      try {
        io.to(`user_${user.id}`).emit('accountDisabled', {
          disabledBy: actionBy || req.user.email,
          reason: reason || 'Disabled by administrator',
          enabledUntil: enabledUntilDate,
          duration: duration || 'permanent',
          timestamp: new Date().toISOString()
        });
      } catch (socketError) {
        console.error('⚠️ Socket notification failed:', socketError);
      }
    }
    
    // Notify admins
    try {
      await notifyAllAdmins(db, io, 'account_disabled', 'Account Disabled', {
        userId: user.id,
        email: user.email,
        name: user.name,
        employeeId: user.employee_id,
        department: user.department,
        disabledBy: actionBy || req.user.email,
        reason: reason || 'Disabled by administrator',
        enabledUntil: enabledUntilDate,
        duration: duration || 'permanent',
        action: 'disabled'
      });
    } catch (adminNotifyError) {
      console.error('⚠️ Admin notification failed:', adminNotifyError);
    }
    
    res.json({
      success: true,
      message: enabledUntilDate 
        ? `User account disabled until ${enabledUntilDate.toLocaleString()}`
        : 'User account disabled permanently'
    });
    
  } catch (error) {
    console.error('❌ Disable user error:', error);
    
    if (error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ECONNREFUSED') {
      return res.status(500).json({
        success: false,
        message: 'Database connection error. Please try again.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to disable user account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* =======================
   GET DISABLED USERS
======================= */
router.get('/disabled', requireAdmin, async (req, res) => {
  try {
    const db = await connectDB();

    const [rows] = await db.execute(`
      SELECT 
        id,
        employee_id,
        name,
        email,
        phone,
        department,
        is_enabled,
        enabled_until,
        disabled_at,
        disabled_by,
        disabled_reason,
        is_locked,
        is_blocked,
        email_automation_enabled,
        last_login,
        created_at
      FROM users 
      WHERE is_enabled = 0
      ORDER BY disabled_at DESC
    `);

    res.json({ 
      success: true, 
      disabledUsers: rows,
      count: rows.length 
    });
    
  } catch (error) {
    console.error('❌ Get disabled users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch disabled users'
    });
  }
});

/* =======================
   GET PENDING USERS
======================= */
router.get('/pending-users', requireAdmin, async (req, res) => {
  try {
    const db = await connectDB();
    
    const [pendingUsers] = await db.execute(
      `SELECT 
        id, name, email, phone, department, ip_address, created_at
       FROM pending_users 
       ORDER BY created_at DESC`
    );
    
    res.json({
      success: true,
      pendingUsers: pendingUsers,
      count: pendingUsers.length
    });
    
  } catch (error) {
    console.error('❌ Get pending users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending users'
    });
  }
});

/* =======================
   GET LOCKED ACCOUNTS WITH DETAILS
======================= */
router.get('/locked', requireAdmin, async (req, res) => {
  try {
    const db = await connectDB();

    const [rows] = await db.query(`
      SELECT 
        u.id,
        u.employee_id,
        u.name,
        u.email,
        u.phone,
        u.department,
        u.is_locked,
        u.is_blocked,
        u.locked_at,
        u.last_login_ip,
        u.registered_ip,
        
        MAX(CASE WHEN f.attempt_number = 1 THEN f.attempted_at END) AS attempt1_time,
        MAX(CASE WHEN f.attempt_number = 1 THEN f.ip_address END) AS attempt1_ip,
        MAX(CASE WHEN f.attempt_number = 2 THEN f.attempted_at END) AS attempt2_time,
        MAX(CASE WHEN f.attempt_number = 2 THEN f.ip_address END) AS attempt2_ip,
        MAX(CASE WHEN f.attempt_number = 3 THEN f.attempted_at END) AS attempt3_time,
        MAX(CASE WHEN f.attempt_number = 3 THEN f.ip_address END) AS attempt3_ip,
        
        COUNT(f.id) as total_attempts
        
      FROM users u
      LEFT JOIN failed_login_attempts f ON f.email = u.email
      
      WHERE u.is_locked = 1 OR u.is_blocked = 1
      
      GROUP BY u.id, u.employee_id, u.name, u.email, u.phone, u.department,
               u.is_locked, u.is_blocked, u.locked_at, u.last_login_ip, u.registered_ip
      
      ORDER BY u.locked_at DESC
    `);

    res.json({ 
      success: true, 
      lockedUsers: rows,
      count: rows.length 
    });
    
  } catch (error) {
    console.error('❌ Get locked users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch locked accounts'
    });
  }
});

/* =======================
   SYSTEM SETTINGS
======================= */
router.get('/system/settings', requireAdmin, async (req, res) => {
  try {
    const db = await connectDB();
    
    const [settingsRows] = await db.execute(
      'SELECT setting_key, setting_value FROM system_settings'
    );
    
    const settings = {};
    settingsRows.forEach(row => {
      if (row.setting_key === 'emailAutomation') {
        settings[row.setting_key] = row.setting_value === 'true' || row.setting_value === '1';
      } else {
        settings[row.setting_key] = row.setting_value;
      }
    });
    
    const defaultSettings = {
      emailAutomation: true,
      maxLoginAttempts: 3,
      lockDuration: 30,
      otpExpiryHours: 24
    };
    
    res.json({
      success: true,
      settings: { ...defaultSettings, ...settings }
    });
    
  } catch (error) {
    console.error('❌ Get system settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system settings'
    });
  }
});

router.post('/system/settings', requireAdmin, async (req, res) => {
  try {
    const { key, value } = req.body;
    const db = await connectDB();
    
    if (!key || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Key and value are required'
      });
    }
    
    const stringValue = value.toString();
    
    const [existing] = await db.execute(
      'SELECT setting_key FROM system_settings WHERE setting_key = ?',
      [key]
    );
    
    if (existing.length > 0) {
      await db.execute(
        'UPDATE system_settings SET setting_value = ?, updated_at = ? WHERE setting_key = ?',
        [stringValue, new Date(), key]
      );
    } else {
      await db.execute(
        'INSERT INTO system_settings (setting_key, setting_value, created_at, updated_at) VALUES (?, ?, ?, ?)',
        [key, stringValue, new Date(), new Date()]
      );
    }
    
    const io = req.app.get('io');
    if (io) {
      io.emit('systemSettingUpdated', { key, value });
    }
    
    res.json({
      success: true,
      message: 'Setting updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Update system settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update system settings'
    });
  }
});

/* =======================
   SCHEDULED TASK TO AUTO-ENABLE USERS
======================= */
router.post('/auto-enable-expired', requireAdmin, async (req, res) => {
  try {
    const db = await connectDB();
    
    const [expiredUsers] = await db.execute(`
      SELECT id, name, email, employee_id 
      FROM users 
      WHERE is_enabled = 0 
        AND enabled_until IS NOT NULL 
        AND enabled_until <= ?
    `, [new Date()]);
    
    let enabledCount = 0;
    
    for (const user of expiredUsers) {
      await db.execute(
        'UPDATE users SET is_enabled = 1, enabled_until = NULL, disabled_at = NULL, disabled_by = NULL, disabled_reason = NULL WHERE id = ?',
        [user.id]
      );
      
      await createNotification(db, 'account_auto_enabled', 'Account Auto-Enabled', user.id, {
        reason: 'Auto-enabled after disable period expired',
        timestamp: new Date().toISOString()
      });
      
      enabledCount++;
    }
    
    res.json({
      success: true,
      message: `Auto-enabled ${enabledCount} user(s)`,
      count: enabledCount,
      users: expiredUsers
    });
    
  } catch (error) {
    console.error('❌ Auto-enable error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to auto-enable users'
    });
  }
});

/* =======================
   APPROVE/REJECT USER - UPDATED WITH EMAIL NOTIFICATION
======================= */
router.post('/approval/:id', requireAdmin, async (req, res) => {
  const pendingUserId = req.params.id;
  const { action } = req.body; 
  const db = await connectDB();

  try {
    const [pendingRows] = await db.execute(`SELECT * FROM pending_users WHERE id = ?`, [pendingUserId]);
    if (pendingRows.length === 0) return res.status(404).json({ 
      success: false,
      message: "User not found." 
    });
    
    const pendingUser = pendingRows[0];

    if (action === 'approve') {
      // Generate employee ID
      const [maxIdRow] = await db.execute(
        `SELECT MAX(CAST(SUBSTRING(employee_id, 3) AS UNSIGNED)) AS max_num FROM users WHERE employee_id LIKE 'EC%'`
      );
      const maxNum = maxIdRow[0]?.max_num || 1000;
      const employee_id = `EC${String(maxNum + 1).padStart(4, '0')}`;
      
      // Determine admin status based on department
      const isAdmin = pendingUser.department === 'Admin' ? 1 : 0;
      
      // Insert into users table with email_automation_enabled default to 1 (enabled)
      await db.execute(
        `INSERT INTO users (name, email, password, department, phone, employee_id, is_admin, is_approved, email_automation_enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
        [pendingUser.name, pendingUser.email, pendingUser.password_hash, 
         pendingUser.department, pendingUser.phone, employee_id, isAdmin, new Date()]
      );

      // Remove from pending
      await db.execute(`DELETE FROM pending_users WHERE id = ?`, [pendingUserId]);
      
      // ============= SEND APPROVAL EMAIL TO USER =============
      const emailSent = await sendApprovalEmail(
        pendingUser.email,
        pendingUser.name,
        employee_id,
        pendingUser.department
      );
      
      if (emailSent) {
        console.log(`✅ Approval email sent to ${pendingUser.email}`);
      } else {
        console.warn(`⚠️ Approval email could not be sent to ${pendingUser.email}`);
      }
      // =======================================================
      
      // Notify admins
      const io = req.app.get('io');
      await notifyAllAdmins(db, io, 'user_approved', 'User Approved', {
        name: pendingUser.name,
        email: pendingUser.email,
        department: pendingUser.department,
        employeeId: employee_id,
        approvedBy: req.user.email,
        action: 'approved',
        emailSent: emailSent
      });
      
      res.json({ 
        success: true,
        message: `User approved successfully.${!emailSent ? ' (Email notification failed)' : ''}`,
        employee_id,
        emailSent
      });

    } else if (action === 'reject') {
      // Remove from pending
      await db.execute(`DELETE FROM pending_users WHERE id = ?`, [pendingUserId]);
      
      // Notify admins
      const io = req.app.get('io');
      await notifyAllAdmins(db, io, 'user_rejected', 'User Rejected', {
        name: pendingUser.name,
        email: pendingUser.email,
        department: pendingUser.department,
        rejectedBy: req.user.email,
        action: 'rejected'
      });
      
      res.json({ 
        success: true,
        message: `User rejected.` 
      });
    } else {
      res.status(400).json({ 
        success: false,
        message: 'Invalid action.' 
      });
    }
  } catch (err) {
    console.error("❌ Approval Error:", err);
    res.status(500).json({ 
      success: false,
      message: `Failed to ${action} user.` 
    });
  }
});

/* =======================
   UNLOCK ACCOUNT
======================= */
router.post('/unlock-account', requireAdmin, async (req, res) => {
  try {
    const { email, unlockedBy } = req.body;
    const db = await connectDB();
    
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }
    
    const [userInfo] = await db.execute(
      'SELECT id, name, employee_id, department FROM users WHERE email = ?',
      [email]
    );
    
    if (userInfo.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    const user = userInfo[0];
    
    await db.execute(
      'UPDATE users SET is_locked = 0, login_attempts = 0, locked_at = NULL WHERE email = ?',
      [email]
    );
    
    await createNotification(db, 'account_unlocked', 'Account Unlocked', user.id, {
      unlockedBy: unlockedBy || req.user.email,
      timestamp: new Date().toISOString()
    });
    
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${user.id}`).emit('accountUnlocked', {
        unlockedBy: unlockedBy || req.user.email,
        timestamp: new Date().toISOString()
      });
    }
    
    await notifyAllAdmins(db, io, 'account_unlocked', 'Account Unlocked', {
      email,
      name: user.name,
      employeeId: user.employee_id,
      department: user.department,
      unlockedBy: unlockedBy || req.user.email,
      action: 'unlocked'
    });
    
    res.json({
      success: true,
      message: 'Account unlocked successfully'
    });
    
  } catch (error) {
    console.error('❌ Unlock account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlock account'
    });
  }
});

/* =======================
   BLOCK ACCOUNT
======================= */
router.post('/block-account', requireAdmin, async (req, res) => {
  try {
    const { email, blockedBy, reason } = req.body;
    const db = await connectDB();
    
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }
    
    const [userInfo] = await db.execute(
      'SELECT id, name, employee_id, department FROM users WHERE email = ?',
      [email]
    );
    
    if (userInfo.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    const user = userInfo[0];
    
    await db.execute(
      'UPDATE users SET is_blocked = 1, is_locked = 1, blocked_at = ? WHERE email = ?',
      [new Date(), email]
    );
    
    await createNotification(db, 'account_blocked', 'Account Blocked', user.id, {
      blockedBy: blockedBy || req.user.email,
      reason: reason || 'Administrative block',
      timestamp: new Date().toISOString()
    });
    
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${user.id}`).emit('accountBlocked', {
        blockedBy: blockedBy || req.user.email,
        reason: reason || 'Administrative block',
        timestamp: new Date().toISOString()
      });
    }
    
    await db.execute(
      'INSERT INTO account_blocks (email, blocked_by, reason, blocked_at) VALUES (?, ?, ?, ?)',
      [email, blockedBy, reason, new Date()]
    );
    
    await notifyAllAdmins(db, io, 'account_locked', 'Account Locked', {
      email,
      name: user.name,
      employeeId: user.employee_id,
      department: user.department,
      blockedBy: blockedBy || req.user.email,
      reason: reason || 'Administrative block',
      action: 'blocked'
    });
    
    res.json({
      success: true,
      message: 'Account blocked permanently'
    });
    
  } catch (error) {
    console.error('❌ Block account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to block account'
    });
  }
});

/* =======================
   BATCH UPDATE EMAIL AUTOMATION
======================= */
router.post('/batch-update-email-automation', requireAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    const db = await connectDB();
    
    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        message: 'enabled field is required'
      });
    }
    
    await db.execute(
      'UPDATE users SET email_automation_enabled = ? WHERE is_admin = 0',
      [enabled ? 1 : 0]
    );
    
    console.log(`✅ Batch updated email automation for all non-admin users to: ${enabled ? 'enabled' : 'disabled'}`);
    
    res.json({
      success: true,
      message: `Email automation ${enabled ? 'enabled' : 'disabled'} for all non-admin users`,
      updatedCount: 'all'
    });
    
  } catch (error) {
    console.error('❌ Batch update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to batch update email automation'
    });
  }
});

export default router;
