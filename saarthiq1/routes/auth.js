// routes/auth.js - EXTENDED FOR JOB SEEKER & EMPLOYER ROLES (Member 1)
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
  requireAdmin,
  validateEmail,
  validatePhone,
} from '../middleware/auth.js';

const router = express.Router();

const CONFIG = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  VALID_DEPARTMENTS: ['Business Development', 'Franchise', 'Recruitment', 'Admin'],
  LOGIN: { MAX_ATTEMPTS: 3, LOCK_DURATION: 30, WARN_ON_ATTEMPT: 1 },
  JWT_EXPIRY: '7d',
  OTP_EXPIRY_HOURS: 24,
  PASSWORD_HASH_ROUNDS: 12,
};

const CONNECTION_LIMIT = 75;
let emailCount = 0;
const EMAIL_LIMIT_PER_DAY = 100;
const allowedEmailTypes = ['registration_approved', 'otp', 'password_reset'];

let resendClient = null;
try {
  if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
} catch (error) {
  console.error('Failed to initialize Resend:', error.message);
}

async function sendEmail(to, subject, html, text = '', type = 'general') {
  if (!allowedEmailTypes.includes(type)) return false;
  if (!resendClient) return false;
  if (emailCount >= EMAIL_LIMIT_PER_DAY) return false;
  try {
    const plainText = text || html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const response = await resendClient.emails.send({
      from: 'Talent Corner <team@saarthiq.in>',
      to,
      subject: `Talent Corner - ${subject}`,
      html,
      text: plainText,
    });
    if (response.error) return false;
    emailCount++;
    return true;
  } catch (error) {
    return false;
  }
}

setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) emailCount = 0;
}, 60000);

async function generateUniqueEmployeeId(db) {
  const [maxIdRow] = await db.execute(
    `SELECT MAX(CAST(SUBSTRING(employee_id, 3) AS UNSIGNED)) AS max_num FROM users WHERE employee_id IS NOT NULL AND employee_id LIKE 'EC%'`
  );
  const maxNum = maxIdRow[0]?.max_num || 1000;
  return `EC${String(maxNum + 1).padStart(4, '0')}`;
}

async function validateUserPassword(user, password) {
  try {
    if (user.password?.startsWith('$2')) {
      if (await bcrypt.compare(password, user.password)) return true;
    }
    if (user.password_hash?.startsWith('$2')) {
      if (await bcrypt.compare(password, user.password_hash)) return true;
    }
    if (user.password && !user.password.startsWith('$2')) {
      if (user.password === password) return true;
    }
    if (!user.password && !user.password_hash) return true;
    return false;
  } catch (error) {
    return false;
  }
}

function is2FAGracePeriodActive(last2FADate) {
  if (!last2FADate) return false;
  const hoursDiff = (new Date() - new Date(last2FADate)) / (1000 * 60 * 60);
  return hoursDiff < CONFIG.OTP_EXPIRY_HOURS;
}

async function updateLoginAttempts(db, email, increment = true) {
  try {
    if (increment) {
      await db.execute('UPDATE users SET login_attempts = COALESCE(login_attempts, 0) + 1 WHERE email = ?', [email]);
    } else {
      await db.execute('UPDATE users SET login_attempts = 0 WHERE email = ?', [email]);
    }
    const [result] = await db.execute('SELECT login_attempts FROM users WHERE email = ?', [email]);
    return result[0]?.login_attempts || 0;
  } catch (error) {
    return 0;
  }
}

async function lockUserAccount(db, user, ip, req) {
  await db.execute('UPDATE users SET is_locked = 1, locked_at = NOW() WHERE id = ?', [user.id]);
  const io = req.app.get('io');
  if (io) io.emit('accountLocked', { email: user.email, name: user.name, employeeId: user.employee_id, ip, attempts: user.login_attempts || 0 });
}

async function createAdminNotification(db, type, title, data) {
  try {
    const [admins] = await db.execute('SELECT id FROM users WHERE is_admin = 1');
    for (const admin of admins) {
      await db.execute(`INSERT INTO notifications (type, title, user_id, data, created_at) VALUES (?, ?, ?, ?, NOW())`, [type, title, admin.id, JSON.stringify(data)]);
    }
    return true;
  } catch (error) {
    return false;
  }
}

function validatePhoneNumber(phone) {
  let cleanPhone = phone.toString().replace(/\D/g, '');
  if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
  if (cleanPhone.length !== 10) throw new Error('Phone number must be exactly 10 digits');
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) throw new Error('Phone number must be a valid Indian mobile starting with 6-9');
  return cleanPhone;
}

function normalizeMobile(mobileNumber) {
  if (!mobileNumber) return '';
  let clean = mobileNumber.toString().replace(/\D/g, '');
  if (clean.length > 10) clean = clean.slice(-10);
  return clean;
}

async function generateOTP(db, email) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + CONFIG.OTP_EXPIRY_HOURS * 60 * 60 * 1000);
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS user_otps (id INT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(255) NOT NULL, otp VARCHAR(10) NOT NULL, otp_expiry DATETIME NOT NULL, is_used TINYINT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, used_at DATETIME, INDEX idx_email (email), INDEX idx_otp_expiry (otp_expiry))`);
  } catch (error) {}
  await db.execute('DELETE FROM user_otps WHERE email = ? AND (is_used = 1 OR otp_expiry < NOW())', [email]);
  await db.execute('INSERT INTO user_otps (email, otp, otp_expiry) VALUES (?, ?, ?)', [email, otp, expiry]);
  return { otp, expiry };
}

async function completeLogin(user, req, res) {
  try {
    const db = await connectDB();
    const connectionManager = req.app.get('connectionManager');
    if (connectionManager) {
      const status = connectionManager.getConnectionStatus();
      if (status.isLimitReached) {
        return res.status(503).json({ success: false, error: `Server is at capacity. Maximum ${CONNECTION_LIMIT} concurrent connections reached.`, statusCode: 503, connectionStatus: status });
      }
    }
    await db.execute(`UPDATE users SET last_login = NOW(), last_login_ip = ?, last_activity = NOW(), last_2fa_verified = NOW() WHERE id = ?`, [req.ip, user.id]);
    try {
      await db.execute(`INSERT INTO login_logs (user_id, ip_address, user_agent) VALUES (?, ?, ?)`, [user.id, req.ip || req.connection?.remoteAddress, req.headers['user-agent'] || null]);
    } catch (logError) {}
    let connectionId = null;
    if (connectionManager) {
      connectionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
      connectionManager.addActiveConnection(connectionId, { userId: user.id, email: user.email, name: user.name, department: user.department, isAdmin: user.is_admin, ip: req.ip });
    }
    if (user.password && user.password.length < 8) {
      await db.execute('UPDATE users SET needs_password_reset = 1 WHERE id = ?', [user.id]);
    }
    const actualDepartment = user.department;
    const reportDepartment = actualDepartment === 'Admin' ? 'Business Development' : actualDepartment;
    const role = user.role || user.user_type || user.department || null;
    const payload = { id: user.id, email: user.email, role, name: user.name, is_admin: user.is_admin, department: reportDepartment, employee_id: user.employee_id, actual_department: actualDepartment, connectionId };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: CONFIG.JWT_EXPIRY });
    const io = req.app.get('io');
    if (io) {
      if (connectionManager) {
        const status = connectionManager.getConnectionStatus();
        io.emit('connectionCountUpdate', { count: status.currentCount, status });
      }
      io.to('admin').emit('userConnection', { userId: user.id, name: user.name, email: user.email, department: user.department, connectionTime: new Date().toISOString(), connectionId });
    }
    if (user.is_admin !== 1) {
      await createAdminNotification(db, 'user_login', 'User Logged In', { userId: user.id, name: user.name, email: user.email, department: actualDepartment, ip: req.ip, connectionId });
    }
    return {
      success: true,
      message: 'Login successful!',
      data: { token, id: user.id, name: user.name, email: user.email, phone: user.phone, role, department: reportDepartment, is_admin: user.is_admin, employee_id: user.employee_id, canEditProfile: user.can_edit_profile, connectionId },
    };
  } catch (error) {
    throw error;
  }
}

router.get('/connection-status', async (req, res) => {
  try {
    const connectionManager = req.app.get('connectionManager');
    if (!connectionManager) {
      return res.status(200).json({ success: true, data: { connectionStatus: { currentCount: 0, maxConnections: CONNECTION_LIMIT, isWarningThreshold: false, isLimitReached: false, remainingConnections: CONNECTION_LIMIT, isLoading: false } } });
    }
    const status = connectionManager.getConnectionStatus();
    res.json({ success: true, data: { connectionStatus: { currentCount: status.currentCount, maxConnections: status.maxConnections, warningThreshold: status.warningThreshold, isWarningThreshold: status.isWarningThreshold, isLimitReached: status.isLimitReached, remainingConnections: status.remainingConnections, isLoading: false } } });
  } catch (error) {
    res.status(200).json({ success: true, data: { connectionStatus: { currentCount: 0, maxConnections: CONNECTION_LIMIT, isWarningThreshold: false, isLimitReached: false, remainingConnections: CONNECTION_LIMIT, isLoading: false } } });
  }
});

router.get('/health', (req, res) => {
  const connectionManager = req.app.get('connectionManager');
  const status = connectionManager ? connectionManager.getConnectionStatus() : { currentCount: 0 };
  res.json({ success: true, message: 'healthy', data: { status: 'healthy', timestamp: new Date().toISOString(), connections: status.currentCount || 0, uptime: process.uptime(), memory: process.memoryUsage() } });
});

router.post('/logout', sanitizeInput, async (req, res) => {
  try {
    const { connectionId } = req.body;
    if (connectionId) {
      const connectionManager = req.app.get('connectionManager');
      if (connectionManager) {
        const removed = connectionManager.removeConnection(connectionId);
        if (removed) {
          const io = req.app.get('io');
          if (io) {
            io.emit('userLogout', { connectionId });
            const status = connectionManager.getConnectionStatus();
            io.emit('connectionCountUpdate', { count: status.currentCount, status });
          }
        }
      }
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Logout failed', statusCode: 500 });
  }
});

router.post('/register', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { name, email, password, department, phone } = req.body;
    if (!name || !email || !password || !department || !phone) {
      return res.status(400).json({ success: false, error: 'All fields are required', statusCode: 400 });
    }
    if (!CONFIG.VALID_DEPARTMENTS.includes(department)) {
      return res.status(400).json({ success: false, error: 'Invalid department', statusCode: 400 });
    }
    if (!CONFIG.EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format', statusCode: 400 });
    }
    const passwordError = validatePasswordStrength(password, 'strict');
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError, statusCode: 400 });
    }
    const cleanPhone = validatePhoneNumber(phone);
    const db = await connectDB();
    const [activeUser] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (activeUser.length > 0) {
      return res.status(409).json({ success: false, error: 'An active account with this email already exists.', statusCode: 409 });
    }
    const [pendingUser] = await db.execute('SELECT id FROM pending_users WHERE email = ?', [email]);
    if (pendingUser.length > 0) {
      return res.status(409).json({ success: false, error: 'Registration is already pending approval.', statusCode: 409 });
    }
    const hashedPassword = await bcrypt.hash(password, CONFIG.PASSWORD_HASH_ROUNDS);
    await db.execute(`INSERT INTO pending_users (name, email, password_hash, department, phone, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`, [name, email, hashedPassword, department, cleanPhone, req.ip]);
    await createAdminNotification(db, 'new_registration', 'New Registration', { name, email, department, phone: cleanPhone, ip: req.ip });
    const io = req.app.get('io');
    if (io) io.to('admin').emit('newRegistration', { name, email, department, phone: cleanPhone });
    res.status(202).json({ success: true, message: 'Registration submitted successfully. You will receive an email when your account is approved by the administrator.' });
  } catch (error) {
    if (error.message.includes('Phone number')) {
      return res.status(400).json({ success: false, error: error.message, statusCode: 400 });
    }
    res.status(500).json({ success: false, error: 'Server error during registration.', statusCode: 500 });
  }
});

router.post('/register/job-seeker', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { firstName, lastName, email, mobileNumber, password } = req.body;
    if (!firstName || !lastName || !email || !mobileNumber || !password) {
      return res.status(400).json({ success: false, error: 'All fields are required', statusCode: 400 });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format', statusCode: 400 });
    }
    if (!validatePhone(mobileNumber)) {
      return res.status(400).json({ success: false, error: 'Invalid mobile number. Must be 10 digits starting with 6-9.', statusCode: 400 });
    }
    const cleanMobile = normalizeMobile(mobileNumber);
    const passwordError = validatePasswordStrength(password, 'strict');
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError, statusCode: 400 });
    }
    const db = await connectDB();
    const [existingUsers] = await db.execute(`SELECT id, email, phone, user_type FROM users WHERE email = ? OR phone = ?`, [email, cleanMobile]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ success: false, error: 'Email or mobile number already registered.', statusCode: 409, code: 'DUPLICATE_USER' });
    }
    const hashedPassword = await bcrypt.hash(password, CONFIG.PASSWORD_HASH_ROUNDS);
    await db.execute(`INSERT INTO users (name, email, password_hash, phone, user_type, is_approved, registered_ip, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, NOW())`, [`${firstName} ${lastName}`.trim(), email, hashedPassword, cleanMobile, 'job_seeker', req.ip]);
    res.status(201).json({ success: true, message: 'Job seeker registered successfully.', data: { email, mobileNumber: cleanMobile, role: 'job_seeker' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error during job seeker registration.', statusCode: 500 });
  }
});

router.post('/register/employer', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { companyName, contactPersonName, email, mobileNumber, password } = req.body;
    if (!companyName || !contactPersonName || !email || !mobileNumber || !password) {
      return res.status(400).json({ success: false, error: 'All fields are required', statusCode: 400 });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format', statusCode: 400 });
    }
    if (!validatePhone(mobileNumber)) {
      return res.status(400).json({ success: false, error: 'Invalid mobile number. Must be 10 digits starting with 6-9.', statusCode: 400 });
    }
    const cleanMobile = normalizeMobile(mobileNumber);
    const passwordError = validatePasswordStrength(password, 'strict');
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError, statusCode: 400 });
    }
    const db = await connectDB();
    const [existingUsers] = await db.execute(`SELECT id, email, phone, user_type FROM users WHERE email = ? OR phone = ?`, [email, cleanMobile]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ success: false, error: 'Email or mobile number already registered.', statusCode: 409, code: 'DUPLICATE_USER' });
    }
    const hashedPassword = await bcrypt.hash(password, CONFIG.PASSWORD_HASH_ROUNDS);
    await db.execute(`INSERT INTO users (name, email, password_hash, phone, user_type, company_name, is_approved, registered_ip, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW())`, [contactPersonName, email, hashedPassword, cleanMobile, 'employer', companyName, req.ip]);
    res.status(201).json({ success: true, message: 'Employer registered successfully.', data: { email, mobileNumber: cleanMobile, role: 'employer', companyName } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error during employer registration.', statusCode: 500 });
  }
});

router.post('/login', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Identifier (email or mobile) and password are required', statusCode: 400 });
    }
    const db = await connectDB();
    const cleanPhoneCandidate = normalizeMobile(identifier);
    const isPhoneLike = cleanPhoneCandidate.length === 10 && /^[6-9]\d{9}$/.test(cleanPhoneCandidate);
    const queryField = isPhoneLike ? 'phone' : 'email';
    const [users] = await db.execute(`SELECT * FROM users WHERE ${queryField} = ? AND is_approved = 1`, [isPhoneLike ? cleanPhoneCandidate : identifier]);
    if (users.length === 0) {
      const [pending] = await db.execute('SELECT email FROM pending_users WHERE email = ?', [identifier]);
      if (pending.length > 0) {
        return res.status(403).json({ success: false, error: 'Account pending approval.', statusCode: 403, pending: true });
      }
      return res.status(401).json({ success: false, error: 'Invalid credentials.', statusCode: 401 });
    }
    const user = users[0];
    if (user.is_enabled === 0) {
      if (user.enabled_until && new Date(user.enabled_until) > new Date()) {
        const enabledDate = new Date(user.enabled_until);
        return res.status(403).json({ success: false, error: `Account disabled until ${enabledDate.toLocaleString()}.`, statusCode: 403, disabled: true, enabled_until: user.enabled_until, disabled_reason: user.disabled_reason });
      }
      return res.status(403).json({ success: false, error: 'Account is disabled. Please contact administrator.', statusCode: 403, disabled: true, disabled_reason: user.disabled_reason });
    }
    if (user.is_blocked === 1) {
      return res.status(403).json({ success: false, error: 'Account permanently blocked.', statusCode: 403, blocked: true });
    }
    if (user.is_locked === 1) {
      return res.status(403).json({ success: false, error: 'Account locked. Contact administrator.', statusCode: 403, locked: true });
    }
    const passwordValid = await validateUserPassword(user, password);
    if (!passwordValid) {
      const attempts = await updateLoginAttempts(db, user.email, true);
      const remaining = CONFIG.LOGIN.MAX_ATTEMPTS - attempts;
      try {
        await db.execute('DELETE FROM failed_login_attempts WHERE email = ? AND attempt_number > 3', [user.email]);
        await db.execute('INSERT INTO failed_login_attempts (email, attempt_number, ip_address, attempted_at) VALUES (?, ?, ?, NOW())', [user.email, attempts, req.ip]);
      } catch (error) {}
      if (remaining <= 0) {
        await lockUserAccount(db, user, req.ip, req);
        await createAdminNotification(db, 'account_locked', 'Account Locked', { email: user.email, name: user.name, employeeId: user.employee_id, ip: req.ip, attempts, lockedAt: new Date().toISOString() });
        return res.status(401).json({ success: false, error: 'Account locked. Contact administrator.', statusCode: 401, locked: true });
      }
      return res.status(401).json({ success: false, error: `Invalid password. ${remaining} attempt(s) remaining.`, statusCode: 401, remainingAttempts: remaining });
    }
    await updateLoginAttempts(db, user.email, false);
    try {
      await db.execute('DELETE FROM failed_login_attempts WHERE email = ?', [user.email]);
    } catch (error) {}
    const require2FA = !is2FAGracePeriodActive(user.last_2fa_verified);
    if (require2FA) {
      return res.json({ success: true, message: 'Password correct. 2FA required.', data: { require2fa: true, email: user.email, name: user.name } });
    }
    const loginResult = await completeLogin(user, req, res);
    if (loginResult) return res.json(loginResult);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error during login.', statusCode: 500 });
  }
});

router.post('/request-2fa-otp', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required', statusCode: 400 });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ success: false, error: 'Invalid email format', statusCode: 400 });
    const db = await connectDB();
    const [users] = await db.execute('SELECT id, name, email, is_approved, is_locked, is_blocked, last_2fa_verified, department FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.status(404).json({ success: false, error: 'User not found', statusCode: 404 });
    const user = users[0];
    if (user.is_blocked === 1) return res.status(403).json({ success: false, error: 'Account is permanently blocked. Please contact administrator.', statusCode: 403 });
    if (user.is_locked === 1) return res.status(403).json({ success: false, error: 'Account is temporarily locked. Please try again later or contact administrator.', statusCode: 403 });
    if (user.is_approved !== 1) return res.status(403).json({ success: false, error: 'Account pending administrator approval. Please contact your HR department.', statusCode: 403 });
    if (is2FAGracePeriodActive(user.last_2fa_verified)) {
      return res.json({ success: true, message: '2FA grace period active', data: { require2fa: false, skipOTP: true, gracePeriodActive: true, lastVerified: user.last_2fa_verified } });
    }
    const [existingOtps] = await db.execute('SELECT id, created_at FROM user_otps WHERE email = ? AND is_used = 0 AND otp_expiry > NOW() AND created_at > DATE_SUB(NOW(), INTERVAL 2 MINUTE)', [email]);
    if (existingOtps.length > 0) {
      const lastOtpTime = new Date(existingOtps[0].created_at);
      const timeDiff = Math.floor((Date.now() - lastOtpTime.getTime()) / 1000);
      const remainingTime = 120 - timeDiff;
      if (remainingTime > 0) {
        return res.status(429).json({ success: false, error: `Please wait ${remainingTime} seconds before requesting a new OTP`, statusCode: 429, retryAfter: remainingTime });
      }
    }
    const { otp, expiry } = await generateOTP(db, email);
    const emailContent = `<div><p>Hello ${user.name},</p><p>Your verification code is: <strong>${otp}</strong></p><p>Expires in ${CONFIG.OTP_EXPIRY_HOURS} hours.</p></div>`;
    const plainText = `Hello ${user.name},\n\nYour verification code is: ${otp}\n\nExpires in ${CONFIG.OTP_EXPIRY_HOURS} hours.`;
    const emailSent = await sendEmail(email, `Your 2FA Verification Code: ${otp}`, emailContent, plainText, 'otp');
    if (!emailSent) {
      if (process.env.NODE_ENV === 'development') {
        return res.json({ success: true, message: 'OTP generated (development mode - check console)', data: { otp, require2fa: true, debug: true, expiry } });
      }
      return res.status(500).json({ success: false, error: 'Failed to send OTP. Please contact administrator or try again later.', statusCode: 500 });
    }
    res.json({ success: true, message: 'OTP sent to your registered email address', data: { require2fa: true, emailSent: true, timestamp: new Date().toISOString() } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate OTP.', statusCode: 500 });
  }
});

router.post('/verify-2fa', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, error: 'Email and OTP are required', statusCode: 400 });
    const db = await connectDB();
    const [otpRows] = await db.execute('SELECT id FROM user_otps WHERE email = ? AND otp = ? AND is_used = 0 AND otp_expiry > NOW()', [email, otp]);
    if (otpRows.length === 0) return res.status(401).json({ success: false, error: 'Invalid or expired OTP', statusCode: 401 });
    await db.execute('UPDATE user_otps SET is_used = 1, used_at = NOW() WHERE id = ?', [otpRows[0].id]);
    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.status(404).json({ success: false, error: 'User not found', statusCode: 404 });
    const user = users[0];
    const loginResult = await completeLogin(user, req, res);
    if (loginResult) return res.json(loginResult);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error during 2FA verification.', statusCode: 500 });
  }
});

router.post('/forgot-password', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required', statusCode: 400 });
    const db = await connectDB();
    const [users] = await db.execute('SELECT id, name, email, is_approved FROM users WHERE email = ? AND is_approved = 1', [email]);
    const responseMessage = 'If an account exists with this email, you will receive a password reset link shortly.';
    if (users.length === 0) return res.json({ success: true, message: responseMessage });
    const user = users[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiry = new Date(Date.now() + 30 * 60 * 1000);
    await db.execute(`CREATE TABLE IF NOT EXISTS password_resets (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL, token_hash VARCHAR(255) NOT NULL, expires_at DATETIME NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, used_at DATETIME, INDEX idx_email (email), INDEX idx_token_hash (token_hash)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    await db.execute('DELETE FROM password_resets WHERE email = ? AND (used_at IS NOT NULL OR expires_at < NOW())', [email]);
    await db.execute('INSERT INTO password_resets (email, token_hash, expires_at) VALUES (?, ?, ?)', [email, tokenHash, expiry]);
    const frontendUrl = (process.env.FRONTEND_URL || 'https://www.saarthiq.in').replace(/\/$/, '');
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;
    const emailContent = `<div><p>Hello ${user.name},</p><p>Click to reset your password: <a href="${resetLink}">Reset Password</a></p><p>This link expires in 30 minutes.</p></div>`;
    const plainText = `Hello ${user.name},\n\nReset your password: ${resetLink}\n\nThis link expires in 30 minutes.`;
    const emailSent = await sendEmail(email, 'Password Reset Request', emailContent, plainText, 'password_reset');
    if (!emailSent) {
      if (process.env.NODE_ENV === 'development') {
        return res.json({ success: true, message: 'Reset link generated (development mode - check console)', data: { resetLink } });
      }
      return res.status(500).json({ success: false, error: 'Failed to send reset email. Please try again or contact support.', statusCode: 500 });
    }
    res.json({ success: true, message: responseMessage, data: { emailSent: true } });
  } catch (error) {
    res.json({ success: true, message: 'If an account exists with this email, you will receive a password reset link shortly.' });
  }
});

router.post('/validate-reset-token', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Token is required', statusCode: 400, valid: false });
    const db = await connectDB();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await db.execute(`CREATE TABLE IF NOT EXISTS password_resets (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL, token_hash VARCHAR(255) NOT NULL, expires_at DATETIME NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, used_at DATETIME, INDEX idx_email (email), INDEX idx_token_hash (token_hash)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    const [resets] = await db.execute('SELECT email, expires_at FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()', [tokenHash]);
    if (resets.length === 0) return res.json({ success: true, valid: false, message: 'Invalid or expired reset token' });
    const row = resets[0];
    const expiryTime = new Date(row.expires_at);
    const minutesRemaining = Math.floor((expiryTime - new Date()) / (1000 * 60));
    res.json({ success: true, valid: true, message: 'Token is valid', data: { email: row.email, expiresIn: minutesRemaining, expiresAt: expiryTime.toISOString() } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error validating token', statusCode: 500, valid: false });
  }
});

router.post('/reset-password', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, error: 'Token and password are required', statusCode: 400 });
    const passwordError = validatePasswordStrength(password, 'strict');
    if (passwordError) return res.status(400).json({ success: false, error: passwordError, statusCode: 400 });
    const db = await connectDB();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [resets] = await db.execute('SELECT email FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()', [tokenHash]);
    if (resets.length === 0) return res.status(400).json({ success: false, error: 'Invalid or expired reset token. Please request a new password reset.', statusCode: 400 });
    const email = resets[0].email;
    const [users] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.status(404).json({ success: false, error: 'User not found for this reset token.', statusCode: 404 });
    const userId = users[0].id;
    const hashedPassword = await bcrypt.hash(password, CONFIG.PASSWORD_HASH_ROUNDS);
    await db.execute('UPDATE users SET password = ?, password_hash = ?, needs_password_reset = 0, login_attempts = 0 WHERE id = ?', [hashedPassword, hashedPassword, userId]);
    await db.execute('UPDATE password_resets SET used_at = NOW() WHERE token_hash = ?', [tokenHash]);
    res.json({ success: true, message: 'Password reset successful! You can now log in with your new password.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error during password reset. Please try again.', statusCode: 500 });
  }
});

router.get('/me', sanitizeInput, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ success: false, error: 'Authentication required.', statusCode: 401 });
  try {
    const db = await connectDB();
    const [rows] = await db.execute(`SELECT id, name, email, phone, department, user_type, is_admin, can_edit_profile, employee_id, last_login, registered_ip, needs_password_reset, total_call_hours, login_attempts, call_count, last_activity, last_2fa_verified FROM users WHERE id = ?`, [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'User not found.', statusCode: 404 });
    const user = rows[0];
    const reportDepartment = user.department === 'Admin' ? 'Business Development' : user.department;
    res.json({
      success: true,
      message: 'User profile fetched successfully.',
      data: {
        id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.user_type || user.department, department: reportDepartment, is_admin: user.is_admin === 1, canEditProfile: user.can_edit_profile === 1, employee_id: user.employee_id, last_login: user.last_login, needsPasswordReset: user.needs_password_reset === 1, last2faVerified: user.last_2fa_verified,
        reportStats: { total_call_hours: user.total_call_hours || '00:00:00', login_attempts: user.login_attempts || 0, call_count: user.call_count || 0, last_activity: user.last_activity },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error fetching profile.', statusCode: 500 });
  }
});

router.post('/change-password', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, error: 'Authentication required.', statusCode: 401 });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, error: 'Both passwords are required', statusCode: 400 });
    const passwordError = validatePasswordStrength(newPassword, 'strict');
    if (passwordError) return res.status(400).json({ success: false, error: passwordError, statusCode: 400 });
    const db = await connectDB();
    const [users] = await db.execute('SELECT password, email, name FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ success: false, error: 'User not found', statusCode: 404 });
    const user = users[0];
    const currentValid = await bcrypt.compare(currentPassword, user.password);
    if (!currentValid) return res.status(401).json({ success: false, error: 'Current password is incorrect', statusCode: 401 });
    const hashedPassword = await bcrypt.hash(newPassword, CONFIG.PASSWORD_HASH_ROUNDS);
    await db.execute('UPDATE users SET password = ?, password_hash = ?, needs_password_reset = 0, last_password_change = NOW() WHERE id = ?', [hashedPassword, hashedPassword, req.user.id]);
    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error', statusCode: 500 });
  }
});

router.post('/request-edit-access', sanitizeInput, sqlInjectionCheck, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, error: 'Authentication required.', statusCode: 401 });
    const { message } = req.body;
    const db = await connectDB();
    const [users] = await db.execute('SELECT name, email, department FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ success: false, error: 'User not found', statusCode: 404 });
    const user = users[0];
    await createAdminNotification(db, 'edit_request', 'Edit Access Request', { userId: req.user.id, name: user.name, email: user.email, department: user.department, message: message || `${user.name} is requesting edit access for their profile.`, timestamp: new Date().toISOString() });
    const io = req.app.get('io');
    if (io) io.to('admin').emit('editRequest', { userId: req.user.id, name: user.name, email: user.email, department: user.department, message });
    res.json({ success: true, message: 'Edit access request sent to admin.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to send edit request', statusCode: 500 });
  }
});

router.post('/admin/approve-user', sanitizeInput, sqlInjectionCheck, requireAdmin, async (req, res) => {
  try {
    const { email, isAdminStatus } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required', statusCode: 400 });
    const db = await connectDB();
    const [pendingRows] = await db.execute('SELECT * FROM pending_users WHERE email = ?', [email]);
    if (pendingRows.length === 0) return res.status(404).json({ success: false, error: 'User not found or already approved.', statusCode: 404 });
    const pendingUser = pendingRows[0];
    const employeeId = await generateUniqueEmployeeId(db);
    await db.execute(
      `INSERT INTO users (name, email, password_hash, phone, department, user_type, is_admin, employee_id, is_approved, registered_ip, created_at, email_automation_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NOW(), 1)`,
      [pendingUser.name, pendingUser.email, pendingUser.password_hash, pendingUser.phone, pendingUser.department, pendingUser.department === 'Recruitment' ? 'recruitment' : pendingUser.department === 'Franchise' ? 'franchisee' : pendingUser.department === 'Business Development' ? 'bd' : 'admin', isAdminStatus || 0, employeeId, pendingUser.ip_address || req.ip]
    );
    const emailSent = await sendEmail(pendingUser.email, 'Registration Approved', `<div><p>Hello ${pendingUser.name},</p><p>Your account has been approved. Employee ID: ${employeeId}</p></div>`, `Hello ${pendingUser.name},\n\nYour account has been approved. Employee ID: ${employeeId}`, 'registration_approved');
    await db.execute('DELETE FROM pending_users WHERE email = ?', [email]);
    res.json({ success: true, message: `User ${email} approved successfully.${!emailSent ? ' (Email notification failed)' : ''}`, data: { employeeId, emailSent } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error during approval. Please try again.', statusCode: 500 });
  }
});

router.post('/check-user', sanitizeInput, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required', statusCode: 400 });
    const db = await connectDB();
    const [users] = await db.execute(`SELECT id, name, email, department, employee_id, is_approved, is_locked, is_blocked, login_attempts FROM users WHERE email = ?`, [email]);
    if (users.length > 0) {
      const user = users[0];
      let status = 'active';
      if (user.is_blocked === 1) status = 'blocked';
      else if (user.is_locked === 1) status = 'locked';
      else if (user.is_approved === 0) status = 'pending';
      return res.json({ success: true, data: { exists: true, status, name: user.name, department: user.department, employeeId: user.employee_id, isLocked: user.is_locked === 1, loginAttempts: user.login_attempts || 0 } });
    }
    const [pending] = await db.execute('SELECT name, email, department FROM pending_users WHERE email = ?', [email]);
    if (pending.length > 0) return res.json({ success: true, data: { exists: true, status: 'pending', ...pending[0] } });
    res.json({ success: true, data: { exists: false, message: 'No account found' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error', statusCode: 500 });
  }
});

export default router;
