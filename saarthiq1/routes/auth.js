// routes/auth.js - COMPLETE UPDATED VERSION WITH FULL EMAIL SUPPORT
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { connectDB } from '../db.js';
import { Resend } from 'resend';
import { 
  validatePasswordStrength, 
  sanitizeInput, 
  sqlInjectionCheck, 
  requireAdmin 
} from '../middleware/auth.js'

const router = express.Router();

// ============ SIMPLE RESEND CONFIGURATION ============
const CONFIG = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  VALID_DEPARTMENTS: ['Business Development', 'Franchise', 'Recruitment', 'Admin'],
  LOGIN: {
    MAX_ATTEMPTS: 3,
    LOCK_DURATION: 30, // minutes
    WARN_ON_ATTEMPT: 1
  },
  JWT_EXPIRY: '7d',
  OTP_EXPIRY_HOURS: 24,
  PASSWORD_HASH_ROUNDS: 12
};

const CONNECTION_LIMIT = 75;

// ============ ENHANCED EMAIL LIMITING SYSTEM ============
let emailCount = 0;
const EMAIL_LIMIT_PER_DAY = 100;
// ONLY 3 EMAIL TYPES ALLOWED
const allowedEmailTypes = ['registration_approved', 'otp', 'password_reset'];

// Initialize Resend
let resendClient = null;
try {
  if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend email service initialized in auth.js');
    console.log(`   From: Talent Corner <team@saarthiq.in>`);
    console.log(`   Daily limit: ${EMAIL_LIMIT_PER_DAY} emails`);
  } else {
    console.warn('❌ RESEND_API_KEY not configured - emails will not be sent');
  }
} catch (error) {
  console.error('❌ Failed to initialize Resend:', error.message);
}

/* HELPER FUNCTIONS */

/**
 * Track and limit emails to prevent exceeding Resend limit
 */
function canSendEmail(type) {
  if (!allowedEmailTypes.includes(type)) {
    console.warn(`❌ Email type "${type}" not allowed. Allowed: ${allowedEmailTypes.join(', ')}`);
    return false;
  }
  
  if (emailCount >= EMAIL_LIMIT_PER_DAY) {
    console.error(`❌ Daily email limit reached (${EMAIL_LIMIT_PER_DAY}/day)`);
    return false;
  }
  
  return true;
}

/**
 * Send email with Resend - LIMITED to 3 types only
 */
async function sendEmail(to, subject, html, text = '', type = 'general') {
  // Log the attempt immediately
  console.log(`📧 Email attempt - Type: ${type}, To: ${to}, Subject: ${subject}`);
  
  // Validate email type
  if (!allowedEmailTypes.includes(type)) {
    console.warn(`❌ Email type "${type}" not in allowed list: ${allowedEmailTypes.join(', ')}`);
    return false;
  }
  
  // Check if Resend client is initialized
  if (!resendClient) {
    console.error('❌ Resend client not initialized. Check RESEND_API_KEY environment variable.');
    console.error('   Current RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'Set (hidden)' : 'Not set');
    return false;
  }
  
  // Check daily limit
  if (emailCount >= EMAIL_LIMIT_PER_DAY) {
    console.error(`❌ Daily email limit reached (${EMAIL_LIMIT_PER_DAY}/day). Cannot send email to: ${to}`);
    return false;
  }

  try {
    console.log(`📧 Sending ${type} email to: ${to} (Count: ${emailCount + 1}/${EMAIL_LIMIT_PER_DAY})`);
    
    // Generate plain text version if not provided
    const plainText = text || html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    const response = await resendClient.emails.send({
      from: 'Talent Corner <team@saarthiq.in>',
      to,
      subject: `Talent Corner - ${subject}`,
      html,
      text: plainText
    });

    if (response.error) {
      console.error(`❌ Resend API error for ${to}:`, response.error);
      return false;
    }

    emailCount++;
    console.log(`✅ Email sent successfully to ${to}`);
    console.log(`   Email ID: ${response.data?.id}`);
    console.log(`   Daily Count: ${emailCount}/${EMAIL_LIMIT_PER_DAY}`);
    
    return true;
    
  } catch (error) {
    console.error(`❌ Email sending error for ${to}:`, error.message);
    if (error.response) {
      console.error('   Resend API response:', error.response.data);
    }
    return false;
  }
}

/**
 * Send registration approval email - Enhanced version
 */
async function sendRegistrationApprovalEmail(to, name, employeeId, department) {
  console.log(`📧 Preparing registration approval email for: ${to}`);
  
  const emailContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Registration Approved - Welcome to Talent Corner</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Registration Approved!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Welcome to Talent Corner</p>
        </div>
        
        <!-- Main Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Welcome Message -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background-color: #d1fae5; width: 100px; height: 100px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
              <svg style="width: 50px; height: 50px; color: #10b981;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 style="color: #065f46; margin: 0 0 15px 0;">Welcome, ${name}!</h2>
            <p style="color: #6b7280; font-size: 18px;">Your account has been approved by the administrator.</p>
          </div>
          
          <!-- SaarthIQ Introduction -->
          <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e6f0fa 100%); padding: 25px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
            <h3 style="color: #1e40af; margin-top: 0; font-size: 20px;">🚀 Welcome to SaarthIQ!</h3>
            <p style="color: #374151; line-height: 1.6; margin-bottom: 15px;">
              SaarthIQ is designed to make your workflow smoother, faster, and more efficient. 
              It provides quick and reliable access to resumes and candidate information, 
              ensuring you have the right data at the right time.
            </p>
            <p style="color: #374151; line-height: 1.6; margin-bottom: 0;">
              <strong>What SaarthIQ offers you:</strong>
            </p>
            <ul style="color: #374151; line-height: 1.6; margin-top: 10px; padding-left: 20px;">
              <li>Quick access to verified candidate profiles</li>
              <li>Reduced time spent on repeated sourcing</li>
              <li>Cost-effective recruitment process</li>
              <li>Streamlined workflow automation</li>
            </ul>
          </div>
          
          <!-- Account Details -->
          <div style="background-color: #f9fafb; padding: 25px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 25px;">
            <h3 style="color: #1f2937; margin-top: 0; margin-bottom: 20px; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
              📋 Your Account Details
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 40%;">Full Name:</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Email Address:</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; color: #2563eb;">${to}</td>
              </tr>
              <tr>
                <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Employee ID:</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb;">
                  <span style="background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 16px;">${employeeId}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Department:</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; font-weight: 500; color: #111827;">${department}</td>
              </tr>
              <tr>
                <td style="padding: 12px 10px; color: #6b7280;">Account Status:</td>
                <td style="padding: 12px 10px;">
                  <span style="background-color: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 14px;">✓ ACTIVE</span>
                </td>
              </tr>
            </table>
          </div>
          
          <!-- Getting Started -->
          <div style="background: linear-gradient(135deg, #ecfdf5 0%, #dcfce7 100%); padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #065f46; margin-top: 0; margin-bottom: 15px; font-size: 18px;">🎯 Getting Started:</h3>
            <ol style="margin: 0; padding-left: 20px; color: #065f46;">
              <li style="margin-bottom: 12px;">
                <strong style="color: #047857;">Login to your account</strong>
                <p style="color: #374151; font-size: 14px; margin: 5px 0 0 0;">Use your registered email and the password you created during registration</p>
              </li>
              <li style="margin-bottom: 12px;">
                <strong style="color: #047857;">Set up Two-Factor Authentication</strong>
                <p style="color: #374151; font-size: 14px; margin: 5px 0 0 0;">You'll be prompted to set up 2FA on your first login for enhanced security</p>
              </li>
              <li style="margin-bottom: 12px;">
                <strong style="color: #047857;">Start using SaarthIQ</strong>
                <p style="color: #374151; font-size: 14px; margin: 5px 0 0 0;">Access candidate profiles, manage recruitment workflows, and track your progress</p>
              </li>
            </ol>
          </div>
          
          <!-- Important Notes -->
          <div style="background-color: #fff7ed; padding: 20px; border-radius: 8px; border-left: 4px solid #f97316; margin-bottom: 25px;">
            <p style="margin: 0 0 10px 0; color: #9a3412; font-weight: 600;">📌 Important Notes:</p>
            <ul style="margin: 0; padding-left: 20px; color: #9a3412; font-size: 14px;">
              <li style="margin-bottom: 8px;">Save your Employee ID - you may need it for support queries</li>
              <li style="margin-bottom: 8px;">Never share your password or 2FA codes with anyone</li>
              <li style="margin-bottom: 8px;">Talent Corner will never ask for your credentials via email or phone</li>
              <li>For technical support, contact your system administrator</li>
            </ul>
          </div>
          
          <!-- Login Button -->
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL || 'https://www.saarthiq.in'}/login" 
               style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(139, 92, 246, 0.3);">
              🔐 Login to Your Account
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 15px;">
              Button not working? Copy and paste this link:<br>
              <span style="color: #6b7280;">${process.env.FRONTEND_URL || 'https://www.saarthiq.in'}/login</span>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; padding-top: 30px; margin-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 5px 0; color: #9ca3af; font-size: 12px;">
              <strong style="color: #6b7280;">Talent Corner H.R. Services Pvt. Ltd.</strong><br>
              This is an automated notification, please do not reply to this email.
            </p>
            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 11px;">
              © ${new Date().getFullYear()} Talent Corner. All rights reserved.<br>
              Empowering recruitment through innovation.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Plain text version
  const plainText = `REGISTRATION APPROVED - WELCOME TO TALENT CORNER!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dear ${name},

Your Talent Corner account has been approved by the administrator!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 WELCOME TO SAARTHIQ!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SaarthIQ is designed to make your workflow smoother, faster, and more efficient. 
It provides quick and reliable access to resumes and candidate information, 
ensuring you have the right data at the right time.

What SaarthIQ offers you:
• Quick access to verified candidate profiles
• Reduced time spent on repeated sourcing
• Cost-effective recruitment process
• Streamlined workflow automation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 YOUR ACCOUNT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Full Name:     ${name}
Email Address: ${to}
Employee ID:   ${employeeId}
Department:    ${department}
Status:        ACTIVE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 GETTING STARTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. LOGIN TO YOUR ACCOUNT
   Use your registered email and the password you created during registration
   URL: ${process.env.FRONTEND_URL || 'https://www.saarthiq.in'}/login

2. SET UP TWO-FACTOR AUTHENTICATION
   You'll be prompted to set up 2FA on your first login for enhanced security

3. START USING SAARTHIQ
   Access candidate profiles, manage recruitment workflows, and track your progress

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 IMPORTANT NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Save your Employee ID - you may need it for support queries
• Never share your password or 2FA codes with anyone
• Talent Corner will never ask for your credentials via email or phone
• For technical support, contact your system administrator

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 LOGIN LINK: ${process.env.FRONTEND_URL || 'https://www.saarthiq.in'}/login
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Talent Corner H.R. Services Pvt. Ltd.
This is an automated notification, please do not reply.

© ${new Date().getFullYear()} Talent Corner. All rights reserved.
Empowering recruitment through innovation.`;

  return await sendEmail(
    to,
    'Registration Approved - Welcome to SaarthIQ!',
    emailContent,
    plainText,
    'registration_approved'
  );
}

// Reset email counter daily at midnight
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    console.log(`🔄 Resetting daily email counter (was: ${emailCount})`);
    emailCount = 0;
  }
}, 60000); // Check every minute

/**
 * Generate unique employee ID
 */
async function generateUniqueEmployeeId(db) {
  const [maxIdRow] = await db.execute(
    `SELECT MAX(CAST(SUBSTRING(employee_id, 3) AS UNSIGNED)) AS max_num 
     FROM users 
     WHERE employee_id IS NOT NULL AND employee_id LIKE 'EC%'`
  );
  
  const maxNum = maxIdRow[0]?.max_num || 1000;
  return `EC${String(maxNum + 1).padStart(4, '0')}`;
}

/**
 * Validate password for existing users (with migration support)
 */
async function validateUserPassword(user, password) {
  try {
    // Check bcrypt hash in password column
    if (user.password?.startsWith('$2')) {
      if (await bcrypt.compare(password, user.password)) {
        console.log(`Password verified via bcrypt (password column) for ${user.email}`);
        return true;
      }
    }
    
    // Check bcrypt hash in password_hash column
    if (user.password_hash?.startsWith('$2')) {
      if (await bcrypt.compare(password, user.password_hash)) {
        console.log(`Password verified via bcrypt (password_hash column) for ${user.email}`);
        return true;
      }
    }
    
    // Plain text password (migration)
    if (user.password && !user.password.startsWith('$2')) {
      if (user.password === password) {
        console.log(`Plain text password accepted for ${user.email} - Please reset`);
        return true;
      }
    }
    
    // No password set (new users)
    if (!user.password && !user.password_hash) {
      console.log(`No password set for ${user.email} - Creating temporary access`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error(`Password validation error for ${user.email}:`, error.message);
    return false;
  }
}

/**
 * Check if 2FA grace period is active
 */
function is2FAGracePeriodActive(last2FADate) {
  if (!last2FADate) return false;
  
  const lastVerified = new Date(last2FADate);
  const now = new Date();
  const hoursDiff = (now - lastVerified) / (1000 * 60 * 60);
  
  return hoursDiff < CONFIG.OTP_EXPIRY_HOURS;
}

/**
 * Update login attempts and return current attempt number
 */
async function updateLoginAttempts(db, email, increment = true) {
  try {
    if (increment) {
      const [updateResult] = await db.execute(
        'UPDATE users SET login_attempts = COALESCE(login_attempts, 0) + 1 WHERE email = ?',
        [email]
      );
      console.log(`📊 Incremented login attempts for ${email}. Rows affected: ${updateResult.affectedRows}`);
    } else {
      const [updateResult] = await db.execute(
        'UPDATE users SET login_attempts = 0 WHERE email = ?',
        [email]
      );
      console.log(`🔄 Reset login attempts for ${email}. Rows affected: ${updateResult.affectedRows}`);
    }
    
    // Fetch the current attempt count
    const [result] = await db.execute(
      'SELECT login_attempts FROM users WHERE email = ?',
      [email]
    );
    
    const attempts = result[0]?.login_attempts || 0;
    console.log(`📈 Current login_attempts for ${email}: ${attempts}`);
    
    return attempts;
  } catch (error) {
    console.error(`❌ Error updating login attempts for ${email}:`, error);
    return 0;
  }
}

/**
 * Lock user account
 */
async function lockUserAccount(db, user, ip, req) {
  await db.execute(
    'UPDATE users SET is_locked = 1, locked_at = NOW() WHERE id = ?',
    [user.id]
  );
  
  console.log(`Account locked: ${user.email} after ${user.login_attempts || 0} attempts`);
  
  // Notify admins via socket (NO EMAIL)
  const io = req.app.get('io');
  if (io) {
    io.emit('accountLocked', {
      email: user.email,
      name: user.name,
      employeeId: user.employee_id,
      ip,
      attempts: user.login_attempts || 0
    });
  }
}

/**
 * Create notification for admins (NO EMAIL)
 */
async function createAdminNotification(db, type, title, data) {
  try {
    const [admins] = await db.execute('SELECT id FROM users WHERE is_admin = 1');
    
    for (const admin of admins) {
      await db.execute(
        `INSERT INTO notifications (type, title, user_id, data, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [type, title, admin.id, JSON.stringify(data)]
      );
    }
    
    // Notify via socket only (NO EMAIL)
    return true;
  } catch (error) {
    console.error('Notification creation error:', error);
    return false;
  }
}

/**
 * Validate and clean phone number
 */
function validatePhoneNumber(phone) {
  let cleanPhone = phone.toString().replace(/\D/g, '');
  
  if (cleanPhone.length > 10) {
    cleanPhone = cleanPhone.slice(-10);
  }
  
  if (cleanPhone.length !== 10) {
    throw new Error('Phone number must be exactly 10 digits');
  }
  
  return cleanPhone;
}

/**
 * Generate OTP and save to database
 */
async function generateOTP(db, email) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + CONFIG.OTP_EXPIRY_HOURS * 60 * 60 * 1000);
  
  // Ensure OTP table exists
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_otps (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL,
        otp VARCHAR(10) NOT NULL,
        otp_expiry DATETIME NOT NULL,
        is_used TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_at DATETIME,
        INDEX idx_email (email),
        INDEX idx_otp_expiry (otp_expiry)
      )
    `);
  } catch (error) {
    console.error('OTP table creation error:', error.message);
  }
  
  // Delete old OTPs
  await db.execute(
    'DELETE FROM user_otps WHERE email = ? AND (is_used = 1 OR otp_expiry < NOW())',
    [email]
  );
  
  // Save new OTP
  await db.execute(
    'INSERT INTO user_otps (email, otp, otp_expiry) VALUES (?, ?, ?)',
    [email, otp, expiry]
  );
  
  return { otp, expiry };
}

/**
 * Complete login process with connection tracking
 */
async function completeLogin(user, req, res) {
  try {
    const db = await connectDB();
    
    // Get connection manager
    const connectionManager = req.app.get('connectionManager');
    
    // Check connection limit before allowing login
    if (connectionManager) {
      const status = connectionManager.getConnectionStatus();
      
      if (status.isLimitReached) {
        return res.status(503).json({
          success: false,
          message: `Server is at capacity. Maximum ${CONNECTION_LIMIT} concurrent connections reached.`,
          connectionStatus: status
        });
      }
    }
    
    await db.execute(
      `UPDATE users SET 
        last_login = NOW(), 
        last_login_ip = ?,
        last_activity = NOW(),
        last_2fa_verified = NOW()
       WHERE id = ?`,
      [req.ip, user.id]
    );

    // After successful login, track the login
    try {
      await db.execute(
        `INSERT INTO login_logs (user_id, ip_address, user_agent) VALUES (?, ?, ?)`,
        [user.id, req.ip || req.connection?.remoteAddress, req.headers['user-agent'] || null]
      );
    } catch (logError) {
      console.error("Error tracking login:", logError);
      // Don't fail the login if tracking fails
    }

    // Track the active connection (for connection limits / live tracking)
    let connectionId = null;
    if (connectionManager) {
      connectionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
      connectionManager.addActiveConnection(connectionId, {
        userId: user.id,
        email: user.email,
        name: user.name,
        department: user.department,
        isAdmin: user.is_admin,
        ip: req.ip
      });
      console.log(`✅ Connection added for ${user.email}: ${connectionId}`);
    }
    
    // Force password reset if weak password detected
    if (user.password && user.password.length < 8) {
      await db.execute(
        'UPDATE users SET needs_password_reset = 1 WHERE id = ?',
        [user.id]
      );
    }
    
    // Prepare user data
    const actualDepartment = user.department;
    const reportDepartment = actualDepartment === 'Admin' ? 'Business Development' : actualDepartment;
    
    const payload = { 
      id: user.id, 
      name: user.name,
      email: user.email, 
      is_admin: user.is_admin,
      department: reportDepartment,
      employee_id: user.employee_id,
      actual_department: actualDepartment,
      connectionId: connectionId
    };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET, { 
      expiresIn: CONFIG.JWT_EXPIRY 
    });
    
    // Notify socket of new connection
    const io = req.app.get('io');
    if (io) {
      if (connectionManager) {
        const status = connectionManager.getConnectionStatus();
        io.emit('connectionCountUpdate', {
          count: status.currentCount,
          status: status
        });
      }
      
      // Emit to admin channel
      io.to('admin').emit('userConnection', {
        userId: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        connectionTime: new Date().toISOString(),
        connectionId: connectionId
      });
    }
    
    // Notify admins of user login via notification only (NO EMAIL)
    if (user.is_admin !== 1) {
      await createAdminNotification(db, 'user_login', 'User Logged In', {
        userId: user.id,
        name: user.name,
        email: user.email,
        department: actualDepartment,
        ip: req.ip,
        connectionId: connectionId
      });
    }
    
    console.log(`✅ Login successful: ${user.email} (Connection: ${connectionId})`);
    
    return {
      success: true,
      message: 'Login successful!',
      token, 
      name: user.name, 
      email: user.email, 
      phone: user.phone,
      department: reportDepartment,
      is_admin: user.is_admin,
      employee_id: user.employee_id,
      userId: user.id,
      canEditProfile: user.can_edit_profile,
      connectionId: connectionId
    };
    
  } catch (error) {
    console.error('Complete login error:', error);
    throw error;
  }
}

/* ========== NEW ENDPOINTS FOR CONNECTION STATUS ========== */

/**
 * Get current connection status
 */
router.get('/connection-status', async (req, res) => {
  try {
    const connectionManager = req.app.get('connectionManager');
    
    if (!connectionManager) {
      return res.status(200).json({
        connectionStatus: {
          currentCount: 0,
          maxConnections: CONNECTION_LIMIT,
          isWarningThreshold: false,
          isLimitReached: false,
          remainingConnections: CONNECTION_LIMIT,
          isLoading: false
        }
      });
    }
    
    const status = connectionManager.getConnectionStatus();
    
    res.json({
      connectionStatus: {
        currentCount: status.currentCount,
        maxConnections: status.maxConnections,
        warningThreshold: status.warningThreshold,
        isWarningThreshold: status.isWarningThreshold,
        isLimitReached: status.isLimitReached,
        remainingConnections: status.remainingConnections,
        isLoading: false
      }
    });
  } catch (error) {
    console.error('Connection status error:', error);
    res.status(200).json({
      connectionStatus: {
        currentCount: 0,
        maxConnections: CONNECTION_LIMIT,
        isWarningThreshold: false,
        isLimitReached: false,
        remainingConnections: CONNECTION_LIMIT,
        isLoading: false
      }
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  const connectionManager = req.app.get('connectionManager');
  const status = connectionManager ? connectionManager.getConnectionStatus() : { currentCount: 0 };
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connections: status.currentCount || 0,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

/* ========== LOGOUT WITH CONNECTION REMOVAL ========== */
router.post('/logout', sanitizeInput, async (req, res) => {
  try {
    const { connectionId } = req.body;
    console.log(`Logout request for connection: ${connectionId}`);
    
    if (connectionId) {
      const connectionManager = req.app.get('connectionManager');
      if (connectionManager) {
        const removed = connectionManager.removeConnection(connectionId);
        
        if (removed) {
          console.log(`✅ Connection removed via logout: ${connectionId} - Total: ${connectionManager.activeConnections.size}`);
          
          // Notify socket
          const io = req.app.get('io');
          if (io) {
            io.emit('userLogout', { connectionId });
            
            const status = connectionManager.getConnectionStatus();
            io.emit('connectionCountUpdate', {
              count: status.currentCount,
              status: status
            });
          }
        } else {
          console.log(`Connection ${connectionId} not found in active connections`);
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

/* ========== REGISTER ENDPOINT - NO EMAILS ========== */
router.post('/register', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { name, email, password, department, phone } = req.body; 
    
    // Validation
    if (!name || !email || !password || !department || !phone) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    if (!CONFIG.VALID_DEPARTMENTS.includes(department)) {
      return res.status(400).json({ message: 'Invalid department' });
    }
    
    if (!CONFIG.EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    const passwordError = validatePasswordStrength(password, 'strict');
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }
    
    const cleanPhone = validatePhoneNumber(phone);
    
    const db = await connectDB();
    
    // Check for existing users
    const [activeUser] = await db.execute(
      'SELECT id FROM users WHERE email = ?', 
      [email]
    );
    
    if (activeUser.length > 0) {
      return res.status(409).json({ 
        message: "An active account with this email already exists." 
      });
    }
    
    const [pendingUser] = await db.execute(
      'SELECT id FROM pending_users WHERE email = ?', 
      [email]
    );
    
    if (pendingUser.length > 0) {
      return res.status(409).json({ 
        message: "Registration is already pending approval." 
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, CONFIG.PASSWORD_HASH_ROUNDS);
    
    // Insert into pending users
    await db.execute(
      `INSERT INTO pending_users (name, email, password_hash, department, phone, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [name, email, hashedPassword, department, cleanPhone, req.ip]
    );
    
    console.log(`✅ Registration submitted: ${name} (${email}) - Awaiting admin approval`);
    
    // NO EMAILS SENT - Only in-app notifications
    // Create notification for admins
    await createAdminNotification(db, 'new_registration', 'New Registration', {
      name, email, department, phone: cleanPhone, ip: req.ip
    });
    
    // Notify via socket
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('newRegistration', {
        name, email, department, phone: cleanPhone
      });
    }
    
    res.status(202).json({ 
      success: true, 
      message: "Registration submitted successfully. You will receive an email when your account is approved by the administrator."
    });
    
  } catch (error) {
    console.error('Registration Error:', error);
    
    if (error.message.includes('Phone number')) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: "Server error during registration.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* ========== LOGIN ENDPOINT ========== */
router.post('/login', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required' 
      });
    }
    
    const db = await connectDB();
    
    // Get user with all necessary fields
    const [users] = await db.execute(
      `SELECT * FROM users WHERE email = ? AND is_approved = 1`, 
      [email]
    );
    
    if (users.length === 0) {
      // Check pending users
      const [pending] = await db.execute(
        'SELECT email FROM pending_users WHERE email = ?', 
        [email]
      );
      
      if (pending.length > 0) {
        return res.status(403).json({ 
          success: false,
          message: "Account pending approval.",
          pending: true 
        });
      }
      
      // Generic error for security
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials."
      });
    }
    
    const user = users[0];
    
    // ✅ ADDED: Check if user is disabled (this should come before other status checks)
    if (user.is_enabled === 0) {
      // Check if there's an enabled_until date that has passed
      if (user.enabled_until && new Date(user.enabled_until) > new Date()) {
        const enabledDate = new Date(user.enabled_until);
        const now = new Date();
        const timeDiff = enabledDate - now;
        const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        return res.status(403).json({ 
          success: false,
          message: `Account disabled until ${enabledDate.toLocaleDateString()} ${enabledDate.toLocaleTimeString()}. (${hoursLeft}h ${minutesLeft}m remaining)`,
          disabled: true,
          enabled_until: user.enabled_until,
          disabled_reason: user.disabled_reason
        });
      }
      
      return res.status(403).json({ 
        success: false,
        message: 'Account is disabled. Please contact administrator.',
        disabled: true,
        disabled_reason: user.disabled_reason
      });
    }
    
    // Check account status
    if (user.is_blocked === 1) {
      return res.status(403).json({ 
        success: false,
        message: 'Account permanently blocked.',
        blocked: true
      });
    }
    
    if (user.is_locked === 1) {
      return res.status(403).json({ 
        success: false,
        message: 'Account locked. Contact administrator.',
        locked: true
      });
    }
    
    // Validate password
    const passwordValid = await validateUserPassword(user, password);
    
    if (!passwordValid) {
      const attempts = await updateLoginAttempts(db, email, true);
      const remaining = CONFIG.LOGIN.MAX_ATTEMPTS - attempts;
      
      // Log the failed attempt with attempt number
      try {
        // First, check if we need to clean old attempts
        await db.execute(
          'DELETE FROM failed_login_attempts WHERE email = ? AND attempt_number > 3',
          [email]
        );
        
        // Insert the failed attempt with attempt number
        await db.execute(
          'INSERT INTO failed_login_attempts (email, attempt_number, ip_address, attempted_at) VALUES (?, ?, ?, NOW())',
          [email, attempts, req.ip]
        );
        
        console.log(`📝 Failed login attempt ${attempts} logged for ${email} from IP ${req.ip}`);
      } catch (error) {
        console.error('Error logging failed attempt:', error);
      }
      
      if (remaining <= 0) {
        await lockUserAccount(db, user, req.ip, req);
        
        await createAdminNotification(db, 'account_locked', 'Account Locked', {
          email: user.email,
          name: user.name,
          employeeId: user.employee_id,
          ip: req.ip,
          attempts,
          lockedAt: new Date().toISOString()
        });
        
        return res.status(401).json({ 
          success: false,
          message: 'Account locked. Contact administrator.',
          locked: true
        });
      }
      
      return res.status(401).json({ 
        success: false,
        message: `Invalid password. ${remaining} attempt(s) remaining.`,
        remainingAttempts: remaining
      });
    }    
    // ✅ Successful password validation
    await updateLoginAttempts(db, email, false);

    // Clear old failed attempts for this user
    try {
      await db.execute(
        'DELETE FROM failed_login_attempts WHERE email = ?',
        [email]
      );
      console.log(`✅ Cleared failed attempts for ${email} after successful login`);
    } catch (error) {
      console.error('Error clearing failed attempts:', error);
    }    
    // Check 2FA requirement
    const require2FA = !is2FAGracePeriodActive(user.last_2fa_verified);
    
    if (require2FA) {
      return res.json({
        success: true,
        message: 'Password correct. 2FA required.',
        require2fa: true,
        email: user.email,
        name: user.name,
        partialAuth: true
      });
    }
    
    // Complete login without 2FA (grace period active)
    const loginResult = await completeLogin(user, req, res);
    if (loginResult) {
      return res.json(loginResult);
    }
    
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ 
      success: false,
      message: "Server error during login."
    });
  }
});

/* ========== REQUEST 2FA OTP ENDPOINT - EMAIL TYPE 2 ========== */
router.post('/request-2fa-otp', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid email format' 
      });
    }
    
    const db = await connectDB();
    
    // Check user exists and is active
    const [users] = await db.execute(
      'SELECT id, name, email, is_approved, is_locked, is_blocked, last_2fa_verified, department FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    const user = users[0];
    
    // Check account status
    if (user.is_blocked === 1) {
      return res.status(403).json({ 
        success: false,
        message: 'Account is permanently blocked. Please contact administrator.' 
      });
    }
    
    if (user.is_locked === 1) {
      return res.status(403).json({ 
        success: false,
        message: 'Account is temporarily locked. Please try again later or contact administrator.' 
      });
    }
    
    if (user.is_approved !== 1) {
      return res.status(403).json({ 
        success: false,
        message: 'Account pending administrator approval. Please contact your HR department.' 
      });
    }
    
    // Check if 2FA grace period is active
    if (is2FAGracePeriodActive(user.last_2fa_verified)) {
      console.log(`✅ 2FA grace period active for ${email}, skipping OTP`);
      return res.json({ 
        success: true,
        message: '2FA grace period active',
        require2fa: false,
        skipOTP: true,
        gracePeriodActive: true,
        lastVerified: user.last_2fa_verified
      });
    }
    
    // Check for existing valid OTP (prevent multiple OTPs within short time)
    const [existingOtps] = await db.execute(
      'SELECT id, created_at FROM user_otps WHERE email = ? AND is_used = 0 AND otp_expiry > NOW() AND created_at > DATE_SUB(NOW(), INTERVAL 2 MINUTE)',
      [email]
    );
    
    if (existingOtps.length > 0) {
      const lastOtpTime = new Date(existingOtps[0].created_at);
      const timeDiff = Math.floor((Date.now() - lastOtpTime.getTime()) / 1000);
      const remainingTime = 120 - timeDiff;
      
      if (remainingTime > 0) {
        return res.status(429).json({ 
          success: false,
          message: `Please wait ${remainingTime} seconds before requesting a new OTP`,
          retryAfter: remainingTime,
          tooManyRequests: true
        });
      }
    }
    
    // Generate and save OTP
    const { otp, expiry } = await generateOTP(db, email);
    
    console.log(`✅ Generated OTP for ${email}: ${otp} (Valid for ${CONFIG.OTP_EXPIRY_HOURS} hours)`);
    
    // Create email content
    const emailContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your 2FA Verification Code</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; margin: 0 0 30px 0;">
            <h1 style="color: white; margin: 0 0 10px 0; font-size: 28px; font-weight: 600;">Two-Factor Authentication</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px;">Secure your login with this verification code</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <p style="font-size: 18px; color: #374151; margin-bottom: 10px;">Hello <strong style="color: #111827;">${user.name}</strong>,</p>
              <p style="color: #6b7280; font-size: 16px; line-height: 1.5;">Use the code below to complete your login to Talent Corner:</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 4px; border-radius: 16px;">
                <div style="background: white; padding: 25px 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                  <div style="margin: 0; font-size: 42px; letter-spacing: 10px; color: #111827; font-family: 'Courier New', monospace; font-weight: 700; text-align: center;">${otp}</div>
                </div>
              </div>
              <p style="color: #6b7280; font-size: 14px; margin-top: 15px;">Expires in ${CONFIG.OTP_EXPIRY_HOURS} hours</p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 30px;">
              <p style="margin: 0 0 10px 0; color: #92400e; font-weight: 600; font-size: 16px;">⚠️ Important Security Information:</p>
              <ul style="margin: 0; padding-left: 20px; color: #92400e;">
                <li style="margin-bottom: 8px;">This code will expire in <strong>${CONFIG.OTP_EXPIRY_HOURS} hours</strong></li>
                <li style="margin-bottom: 8px;">Do not share this code with anyone</li>
                <li style="margin-bottom: 8px;">Talent Corner will never ask for this code via phone or email</li>
                <li>Use this code only on the official Talent Corner portal</li>
              </ul>
            </div>
            
            <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 5px 0; color: #9ca3af; font-size: 12px;">
                <strong>Talent Corner H.R. Services Pvt. Ltd.</strong><br>
                This is an automated security message, please do not reply.
              </p>
              <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 11px;">
                Email ID: ${email}<br>
                Department: ${user.department || 'Not specified'}<br>
                Request Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Plain text version
    const plainText = `TALENT CORNER - TWO-FACTOR AUTHENTICATION

Hello ${user.name},

Use the code below to complete your login to Talent Corner:

VERIFICATION CODE: ${otp}

This code will expire in ${CONFIG.OTP_EXPIRY_HOURS} hours.

IMPORTANT SECURITY INFORMATION:
- This code will expire in ${CONFIG.OTP_EXPIRY_HOURS} hours
- Do not share this code with anyone
- Talent Corner will never ask for this code via phone or email
- Use this code only on the official Talent Corner portal

Talent Corner H.R. Services Pvt. Ltd.
This is an automated security message, please do not reply.`;
    
    // Send OTP email with type parameter
    const emailSent = await sendEmail(
      email,
      `Your 2FA Verification Code: ${otp}`,
      emailContent,
      plainText,
      'otp'
    );
    
    if (!emailSent) {
      console.warn(`⚠️ OTP email not sent for ${email}. Check email configuration.`);
      
      // In development mode, return OTP for testing
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔧 Development mode: OTP for ${email} is ${otp}`);
        return res.json({ 
          success: true,
          message: 'OTP generated (development mode - check console)',
          otp: otp,
          require2fa: true,
          debug: true,
          expiry: expiry
        });
      }
      
      console.log(`⚠️ Production: OTP for ${email} is ${otp} - Email delivery failed`);
      
      return res.status(500).json({ 
        success: false,
        message: 'Failed to send OTP. Please contact administrator or try again later.',
        require2fa: true,
        contactAdmin: true,
        retry: true
      });
    }
    
    console.log(`✅ OTP email sent successfully to ${email}`);
    
    res.json({ 
      success: true,
      message: 'OTP sent to your registered email address',
      require2fa: true,
      emailSent: true,
      timestamp: new Date().toISOString(),
      gracePeriod: false
    });
    
  } catch (error) {
    console.error('OTP request error:', error);
    
    // Fallback for production
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ 
        success: false,
        message: 'OTP service temporarily unavailable. Please try again in a few minutes or contact support.',
        require2fa: true,
        retry: true
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate OTP.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/* ========== VERIFY 2FA ENDPOINT ========== */
router.post('/verify-2fa', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and OTP are required' 
      });
    }
    
    const db = await connectDB();
    
    // Verify OTP
    const [otpRows] = await db.execute(
      'SELECT id FROM user_otps WHERE email = ? AND otp = ? AND is_used = 0 AND otp_expiry > NOW()',
      [email, otp]
    );
    
    if (otpRows.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid or expired OTP' 
      });
    }
    
    // Mark OTP as used
    await db.execute(
      'UPDATE user_otps SET is_used = 1, used_at = NOW() WHERE id = ?',
      [otpRows[0].id]
    );
    
    // Get user data
    const [users] = await db.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    const user = users[0];
    
    // Complete login with connection tracking
    const loginResult = await completeLogin(user, req, res);
    if (loginResult) {
      return res.json(loginResult);
    }
    
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during 2FA verification.'
    });
  }
});

/* ========== FORGOT PASSWORD - EMAIL TYPE 3 ========== */
router.post('/forgot-password', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }
    
    const db = await connectDB();
    
    // Check user exists and is approved
    const [users] = await db.execute(
      'SELECT id, name, email, is_approved FROM users WHERE email = ? AND is_approved = 1',
      [email]
    );
    
    // Always return success message for security (even if user doesn't exist)
    const responseMessage = 'If an account exists with this email, you will receive a password reset link shortly.';
    
    if (users.length === 0) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return res.json({ 
        success: true,
        message: responseMessage
      });
    }
    
    const user = users[0];
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour
    
    // Save token to database
    await db.execute(
      'UPDATE users SET reset_token = ?, token_expiry = ? WHERE id = ?',
      [tokenHash, expiry, user.id]
    );
    
    // Create reset link
    const frontendUrl = (process.env.FRONTEND_URL || 'https://www.saarthiq.in').replace(/\/$/, '');
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;
    
    // Create email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 25px; border-radius: 8px 8px 0 0; text-align: center; margin: -20px -20px 30px -20px;">
          <h1 style="color: white; margin: 0; font-size: 26px;">Password Reset</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Reset your Talent Corner password</p>
        </div>
        
        <div style="margin-bottom: 25px;">
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>We received a request to reset the password for your Talent Corner account.</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
          <p style="margin: 0; color: #92400e;">
            <strong>⚠️ Important:</strong> 
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
              <li>This link will expire in <strong>1 hour</strong></li>
              <li>If you didn't request this reset, you can safely ignore this email</li>
              <li>For security, this link can only be used once</li>
            </ul>
          </p>
        </div>
        
        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
          <p>Talent Corner H.R. Services Pvt. Ltd.<br>
          This is an automated security message, please do not reply.</p>
        </div>
      </div>
    `;
    
    // Plain text version
    const plainText = `Password Reset Request

Hello ${user.name},

We received a request to reset your Talent Corner password.

To reset your password, click the link below:
${resetLink}

This link will expire in 1 hour.

Important:
- If you didn't request this reset, you can safely ignore this email
- For security, this link can only be used once

Talent Corner H.R. Services Pvt. Ltd.
This is an automated security message.`;
    
    // Send reset email with type parameter
    const emailSent = await sendEmail(
      email,
      'Password Reset Request',
      emailContent,
      plainText,
      'password_reset'
    );
    
    if (!emailSent) {
      console.error(`❌ Failed to send password reset email to ${email}`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Development mode: Reset link for ${email} is ${resetLink}`);
        return res.json({ 
          success: true,
          message: 'Reset link generated (development mode - check console)',
          debug: true,
          resetLink: resetLink
        });
      }
      
      return res.status(500).json({ 
        success: false,
        message: 'Failed to send reset email. Please try again or contact support.'
      });
    }
    
    console.log(`✅ Password reset link sent to ${email}`);
    
    // Clean up old reset tokens
    await db.execute(
      'UPDATE users SET reset_token = NULL, token_expiry = NULL WHERE token_expiry < DATE_SUB(NOW(), INTERVAL 2 HOUR)'
    );
    
    res.json({ 
      success: true,
      message: responseMessage,
      emailSent: true
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    
    // Always return success for security
    res.json({ 
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link shortly.'
    });
  }
});

/* ========== VALIDATE RESET TOKEN ========== */
router.post('/validate-reset-token', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        success: false,
        valid: false,
        message: 'Token is required' 
      });
    }
    
    const db = await connectDB();
    
    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Verify token exists and is not expired
    const [users] = await db.execute(
      'SELECT id, email, token_expiry FROM users WHERE reset_token = ? AND token_expiry > NOW()',
      [tokenHash]
    );
    
    if (users.length === 0) {
      return res.json({ 
        success: true,
        valid: false,
        message: 'Invalid or expired reset token' 
      });
    }
    
    const user = users[0];
    const expiryTime = new Date(user.token_expiry);
    const now = new Date();
    const minutesRemaining = Math.floor((expiryTime - now) / (1000 * 60));
    
    res.json({ 
      success: true,
      valid: true,
      message: 'Token is valid',
      email: user.email,
      expiresIn: minutesRemaining,
      expiresAt: expiryTime.toISOString()
    });
    
  } catch (error) {
    console.error('Validate token error:', error);
    res.status(500).json({ 
      success: false,
      valid: false,
      message: 'Server error validating token'
    });
  }
});

/* ========== RESET PASSWORD - NO CONFIRMATION EMAIL ========== */
router.post('/reset-password', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Token and password are required' 
      });
    }
    
    // Validate password strength
    const passwordError = validatePasswordStrength(password, 'strict');
    if (passwordError) {
      return res.status(400).json({ 
        success: false,
        message: passwordError 
      });
    }
    
    const db = await connectDB();
    
    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Verify token
    const [users] = await db.execute(
      'SELECT id, email, name FROM users WHERE reset_token = ? AND token_expiry > NOW()',
      [tokenHash]
    );
    
    if (users.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired reset token. Please request a new password reset.' 
      });
    }
    
    const user = users[0];
    
    // Hash and update password
    const hashedPassword = await bcrypt.hash(password, CONFIG.PASSWORD_HASH_ROUNDS);
    
    await db.execute(
      'UPDATE users SET password = ?, reset_token = NULL, token_expiry = NULL, needs_password_reset = 0, login_attempts = 0 WHERE id = ?',
      [hashedPassword, user.id]
    );
    
    console.log(`✅ Password reset for ${user.email} - NO CONFIRMATION EMAIL SENT`);
    
    // NO CONFIRMATION EMAIL SENT - Only return success message
    
    res.json({ 
      success: true,
      message: 'Password reset successful! You can now log in with your new password.'
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during password reset. Please try again.'
    });
  }
});

/* ========== GET CURRENT USER PROFILE ========== */
router.get('/me', sanitizeInput, async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  
  try {
    const db = await connectDB();
    
    const [rows] = await db.execute(
      `SELECT 
        id, name, email, phone, department, is_admin, 
        can_edit_profile, employee_id, last_login, registered_ip,
        needs_password_reset, total_call_hours, login_attempts, 
        call_count, last_activity, last_2fa_verified
       FROM users WHERE id = ?`, 
      [req.user.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const user = rows[0];
    const reportDepartment = user.department === 'Admin' ? 'Business Development' : user.department;
    
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      department: reportDepartment,
      is_admin: user.is_admin === 1,
      canEditProfile: user.can_edit_profile === 1,
      employee_id: user.employee_id,
      last_login: user.last_login,
      needsPasswordReset: user.needs_password_reset === 1,
      last2faVerified: user.last_2fa_verified,
      reportStats: {
        total_call_hours: user.total_call_hours || '00:00:00',
        login_attempts: user.login_attempts || 0,
        call_count: user.call_count || 0,
        last_activity: user.last_activity
      }
    });
    
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ 
      message: "Server error fetching profile."
    });
  }
});

/* ========== CHANGE PASSWORD - NO EMAIL ========== */
router.post('/change-password', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both passwords are required' });
    }
    
    // Validate new password
    const passwordError = validatePasswordStrength(newPassword, 'strict');
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }
    
    const db = await connectDB();
    
    // Get user with password
    const [users] = await db.execute(
      'SELECT password, email, name FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = users[0];
    
    // Verify current password
    const currentValid = await bcrypt.compare(currentPassword, user.password);
    if (!currentValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, CONFIG.PASSWORD_HASH_ROUNDS);
    
    await db.execute(
      'UPDATE users SET password = ?, needs_password_reset = 0, last_password_change = NOW() WHERE id = ?',
      [hashedPassword, req.user.id]
    );
    
    console.log(`Password changed for user ID: ${req.user.id} - NO EMAIL SENT`);
    
    // NO EMAIL SENT - Only return success message
    
    res.json({ 
      message: 'Password changed successfully!',
      success: true
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      message: 'Server error'
    });
  }
});

/* ========== REQUEST EDIT ACCESS - NO EMAIL ========== */
router.post('/request-edit-access', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    
    const { message } = req.body;
    const db = await connectDB();
    
    // Get user info
    const [users] = await db.execute(
      'SELECT name, email, department FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = users[0];
    
    // Create notification for admins (in-app only)
    await createAdminNotification(db, 'edit_request', 'Edit Access Request', {
      userId: req.user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      message: message || `${user.name} is requesting edit access for their profile.`,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Edit access request from: ${user.email} - NO EMAIL SENT`);
    
    // Notify via socket (in-app only)
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('editRequest', {
        userId: req.user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        message: message
      });
    }
    
    res.json({
      success: true,
      message: 'Edit access request sent to admin.'
    });
    
  } catch (error) {
    console.error('Edit access request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send edit request'
    });
  }
});

/* ========== ADMIN: APPROVE USER - ENHANCED EMAIL TYPE 1 ========== */
router.post('/admin/approve-user', sanitizeInput, sqlInjectionCheck, requireAdmin, async (req, res) => {
  try {
    const { email, isAdminStatus } = req.body; 
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    console.log('==========================================');
    console.log(`🔐 ADMIN APPROVAL - Starting approval process`);
    console.log(`   Email: ${email}`);
    console.log(`   Admin: ${req.user.email}`);
    console.log('==========================================');
    
    const db = await connectDB();
    
    // Get pending user
    const [pendingRows] = await db.execute(
      'SELECT * FROM pending_users WHERE email = ?', 
      [email]
    );
    
    if (pendingRows.length === 0) {
      console.log(`❌ User not found in pending_users: ${email}`);
      return res.status(404).json({ message: "User not found or already approved." });
    }
    
    const pendingUser = pendingRows[0];
    console.log(`✅ Found pending user:`);
    console.log(`   Name: ${pendingUser.name}`);
    console.log(`   Dept: ${pendingUser.department}`);
    console.log(`   Phone: ${pendingUser.phone}`);
    
    // Generate employee ID
    const employeeId = await generateUniqueEmployeeId(db);
    console.log(`   Generated Employee ID: ${employeeId}`);
    
    // Move to users table
    await db.execute(
      `INSERT INTO users (name, email, password_hash, phone, department, is_admin, employee_id, is_approved, registered_ip, created_at, email_automation_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), 1)`,
      [
        pendingUser.name,
        pendingUser.email,
        pendingUser.password_hash,
        pendingUser.phone,
        pendingUser.department,
        isAdminStatus || 0,
        employeeId,
        pendingUser.ip_address || req.ip
      ]
    );
    
    console.log(`✅ User moved to users table: ${email}`);
    
    // ✅ SEND REGISTRATION APPROVAL EMAIL
    console.log(`📧 Attempting to send approval email to: ${pendingUser.email}`);
    
    const emailSent = await sendRegistrationApprovalEmail(
      pendingUser.email,
      pendingUser.name,
      employeeId,
      pendingUser.department
    );

    console.log(`📧 Email send result: ${emailSent ? '✅ SUCCESS' : '❌ FAILED'}`);

    if (emailSent) {
      console.log(`✅ Registration approval email sent successfully to ${pendingUser.email}`);
    } else {
      console.warn(`⚠️ Failed to send approval email to ${pendingUser.email}`);
      console.warn(`   Check: Resend client exists? ${!!resendClient}`);
      console.warn(`   Check: Email type 'registration_approved' allowed? ${allowedEmailTypes.includes('registration_approved')}`);
      console.warn(`   Check: Email count: ${emailCount}/${EMAIL_LIMIT_PER_DAY}`);
    }

    // Remove from pending AFTER email attempt
    await db.execute('DELETE FROM pending_users WHERE email = ?', [email]);
    console.log(`✅ Removed from pending_users: ${email}`);

    console.log(`✅ Admin approval completed for: ${email} (ID: ${employeeId})`);
    console.log('==========================================\n');

    res.json({ 
      success: true, 
      message: `User ${email} approved successfully.${!emailSent ? ' (Email notification failed)' : ''}`,
      employeeId,
      emailSent
    });

  } catch (error) {
    console.error('❌ Admin approval error:', error);
    console.error('   Error details:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack.split('\n')[1]);
    }
    console.log('==========================================\n');
    
    res.status(500).json({ 
      success: false,
      message: "Server error during approval. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* ========== CHECK USER STATUS ========== */
router.post('/check-user', sanitizeInput, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const db = await connectDB();
    
    // Check active users
    const [users] = await db.execute(
      `SELECT 
        id, name, email, department, employee_id,
        is_approved, is_locked, is_blocked, login_attempts
      FROM users WHERE email = ?`,
      [email]
    );
    
    if (users.length > 0) {
      const user = users[0];
      
      let status = 'active';
      if (user.is_blocked === 1) status = 'blocked';
      else if (user.is_locked === 1) status = 'locked';
      else if (user.is_approved === 0) status = 'pending';
      
      return res.json({ 
        exists: true, 
        status,
        name: user.name,
        department: user.department,
        employeeId: user.employee_id,
        isLocked: user.is_locked === 1,
        loginAttempts: user.login_attempts || 0
      });
    }
    
    // Check pending users
    const [pending] = await db.execute(
      'SELECT name, email, department FROM pending_users WHERE email = ?',
      [email]
    );
    
    if (pending.length > 0) {
      return res.json({ 
        exists: true, 
        status: 'pending',
        ...pending[0]
      });
    }
    
    res.json({ 
      exists: false, 
      message: 'No account found'
    });
    
  } catch (error) {
    console.error('Check user error:', error);
    res.status(500).json({ 
      message: 'Server error'
    });
  }
});

export default router;
