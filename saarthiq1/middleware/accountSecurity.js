// backend/middleware/accountSecurity.js
import nodemailer from 'nodemailer';
import { connectDB } from '../db.js';

// Transporter for sending OTP emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Account lock settings
const MAX_LOGIN_ATTEMPTS = 3;
const LOCK_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/* Generate and send OTP */
export async function generateAndSendOTP(email, userName) {
  try {
    const db = await connectDB();
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Check if OTP already exists for this email
    const [existingOTP] = await db.execute(
      'SELECT id FROM user_otps WHERE email = ? AND is_used = 0',
      [email]
    );
    
    if (existingOTP.length > 0) {
      // Update existing OTP
      await db.execute(
        'UPDATE user_otps SET otp = ?, otp_expiry = ?, created_at = NOW() WHERE email = ?',
        [otp, otpExpiry, email]
      );
    } else {
      // Insert new OTP
      await db.execute(
        'INSERT INTO user_otps (email, otp, otp_expiry, created_at) VALUES (?, ?, ?, NOW())',
        [email, otp, otpExpiry]
      );
    }
    
    // Send OTP email
    const mailOptions = {
      from: process.env.EMAIL_USER || 'team@talentcorner.com',
      to: email,
      subject: '🔐 Your 2FA Code for Talent Corner',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Two-Factor Authentication</h2>
          <p>Hello ${userName},</p>
          <p>Your login requires two-factor authentication. Here is your verification code:</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px; color: #4F46E5;">${otp}</h1>
          </div>
          
          <p><strong>This code will expire in 24 hours.</strong></p>
          
          <div style="margin-top: 24px; padding: 16px; background: #fef3c7; border-radius: 6px;">
            <h4 style="margin-top: 0; color: #92400e;">⚠️ Security Note:</h4>
            <ul style="margin-bottom: 0;">
              <li>Never share this code with anyone</li>
              <li>Talent Corner will never ask for your OTP</li>
              <li>If you didn't request this, please ignore this email</li>
            </ul>
          </div>
          
          <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
            This is an automated message. Please do not reply.
          </p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP sent to ${email}: ${otp}`);
    
    return { success: true, message: 'OTP sent successfully' };
    
  } catch (error) {
    console.error('❌ OTP generation error:', error);
    return { success: false, message: 'Failed to send OTP' };
  }
}

/* Verify OTP */
export async function verifyOTP(email, otp) {
  try {
    const db = await connectDB();
    
    // Check valid OTP
    const [otpRows] = await db.execute(
      'SELECT * FROM user_otps WHERE email = ? AND otp = ? AND is_used = 0 AND otp_expiry > NOW()',
      [email, otp]
    );
    
    if (otpRows.length === 0) {
      return { valid: false, message: 'Invalid or expired OTP' };
    }
    
    // Mark OTP as used
    await db.execute(
      'UPDATE user_otps SET is_used = 1, used_at = NOW() WHERE id = ?',
      [otpRows[0].id]
    );
    
    return { valid: true, message: 'OTP verified successfully' };
    
  } catch (error) {
    console.error('❌ OTP verification error:', error);
    return { valid: false, message: 'OTP verification failed' };
  }
}

/* Track failed login attempts */
export async function trackFailedLogin(email, ip) {
  try {
    const db = await connectDB();
    
    // Get current login attempts
    const [userRows] = await db.execute(
      'SELECT login_attempts, last_failed_attempt FROM users WHERE email = ?',
      [email]
    );
    
    if (userRows.length === 0) return;
    
    const user = userRows[0];
    let attempts = user.login_attempts || 0;
    attempts++;
    
    // Update login attempts
    await db.execute(
      'UPDATE users SET login_attempts = ?, last_failed_attempt = NOW() WHERE email = ?',
      [attempts, email]
    );
    
    // Log failed attempt
    await db.execute(
      'INSERT INTO failed_login_attempts (email, attempt_number, ip_address, attempted_at) VALUES (?, ?, ?, NOW())',
      [email, attempts, ip]
    );
    
    // Lock account if max attempts reached
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      await lockAccount(email, ip);
    }
    
    console.log(`⚠️ Failed login attempt ${attempts} for ${email} from IP: ${ip}`);
    
    return {
      attempts: attempts,
      remaining: MAX_LOGIN_ATTEMPTS - attempts,
      locked: attempts >= MAX_LOGIN_ATTEMPTS
    };
    
  } catch (error) {
    console.error('❌ Failed login tracking error:', error);
  }
}

/* Lock account */
export async function lockAccount(email, ip) {
  try {
    const db = await connectDB();
    
    // Lock the account
    await db.execute(
      'UPDATE users SET is_locked = 1, locked_at = NOW(), lock_reason = "Too many failed login attempts" WHERE email = ?',
      [email]
    );
    
    // Log lock event
    await db.execute(
      'INSERT INTO account_locks (email, locked_by_system, ip_address, reason, locked_at) VALUES (?, 1, ?, "Too many failed login attempts", NOW())',
      [email, ip]
    );
    
    // Send lock notification email to user
    const [user] = await db.execute(
      'SELECT name FROM users WHERE email = ?',
      [email]
    );
    
    if (user.length > 0) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: '🔒 Your Talent Corner Account Has Been Locked',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #DC2626;">Account Security Alert</h2>
            <p>Hello ${user[0].name},</p>
            <p>Your Talent Corner account has been locked due to multiple failed login attempts.</p>
            
            <div style="background: #fee2e2; border: 1px solid #fca5a5; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #dc2626;">⚠️ Account Locked</h4>
              <p>Reason: Multiple failed login attempts detected from IP: ${ip}</p>
              <p>Locked at: ${new Date().toLocaleString()}</p>
            </div>
            
            <p><strong>To unlock your account:</strong></p>
            <ol>
              <li>Contact your system administrator</li>
              <li>Request account unlock through the admin panel</li>
            </ol>
            
            <p>If you believe this was a mistake, please contact support immediately.</p>
            
            <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
              This is an automated security alert. Please do not reply.
            </p>
          </div>
        `
      };
      
      await transporter.sendMail(mailOptions);
    }
    
    console.log(`🔒 Account locked for ${email}`);
    
    // Notify admins via socket
    return { locked: true, message: 'Account locked due to multiple failed attempts' };
    
  } catch (error) {
    console.error('❌ Account lock error:', error);
  }
}

/* Unlock account */
export async function unlockAccount(email, unlockedBy) {
  try {
    const db = await connectDB();
    
    // Unlock the account
    await db.execute(
      'UPDATE users SET is_locked = 0, locked_at = NULL, lock_reason = NULL, login_attempts = 0 WHERE email = ?',
      [email]
    );
    
    // Log unlock event
    await db.execute(
      'INSERT INTO account_locks (email, unlocked_by, unlocked_at, is_locked) VALUES (?, ?, NOW(), 0)',
      [email, unlockedBy]
    );
    
    // Send unlock notification email to user
    const [user] = await db.execute(
      'SELECT name FROM users WHERE email = ?',
      [email]
    );
    
    if (user.length > 0) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: '🔓 Your Talent Corner Account Has Been Unlocked',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10B981;">Account Unlocked</h2>
            <p>Hello ${user[0].name},</p>
            <p>Your Talent Corner account has been unlocked by an administrator.</p>
            
            <div style="background: #d1fae5; border: 1px solid #a7f3d0; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #059669;">✅ Account Restored</h4>
              <p>You can now log in to your account normally.</p>
              <p>Unlocked at: ${new Date().toLocaleString()}</p>
            </div>
            
            <p><strong>Security Tips:</strong></p>
            <ul>
              <li>Ensure you're using the correct password</li>
              <li>Consider resetting your password if you've forgotten it</li>
              <li>Contact support if you experience any issues</li>
            </ul>
          </div>
        `
      };
      
      await transporter.sendMail(mailOptions);
    }
    
    console.log(`🔓 Account unlocked for ${email} by ${unlockedBy}`);
    
    return { success: true, message: 'Account unlocked successfully' };
    
  } catch (error) {
    console.error('❌ Account unlock error:', error);
    return { success: false, message: 'Failed to unlock account' };
  }
}

/* Check if account is locked */
export async function checkAccountLock(email) {
  try {
    const db = await connectDB();
    
    const [userRows] = await db.execute(
      'SELECT is_locked, locked_at, login_attempts FROM users WHERE email = ?',
      [email]
    );
    
    if (userRows.length === 0) {
      return { locked: false, attempts: 0 };
    }
    
    const user = userRows[0];
    
    // Auto-unlock after lock time
    if (user.is_locked && user.locked_at) {
      const lockTime = new Date(user.locked_at).getTime();
      const currentTime = Date.now();
      
      if (currentTime - lockTime > LOCK_TIME) {
        // Auto-unlock
        await db.execute(
          'UPDATE users SET is_locked = 0, locked_at = NULL, lock_reason = NULL, login_attempts = 0 WHERE email = ?',
          [email]
        );
        return { locked: false, attempts: 0, autoUnlocked: true };
      }
    }
    
    return {
      locked: user.is_locked === 1,
      attempts: user.login_attempts || 0,
      remaining: MAX_LOGIN_ATTEMPTS - (user.login_attempts || 0),
      lockedAt: user.locked_at
    };
    
  } catch (error) {
    console.error('❌ Account lock check error:', error);
    return { locked: false, attempts: 0 };
  }
}

/* Reset failed attempts on successful login */
export async function resetFailedAttempts(email) {
  try {
    const db = await connectDB();
    
    await db.execute(
      'UPDATE users SET login_attempts = 0, last_failed_attempt = NULL WHERE email = ?',
      [email]
    );
    
    console.log(`✅ Reset failed attempts for ${email}`);
    
  } catch (error) {
    console.error('❌ Reset failed attempts error:', error);
  }
}

/* Get failed login attempts history */
export async function getFailedAttemptsHistory(email) {
  try {
    const db = await connectDB();
    
    const [attempts] = await db.execute(
      'SELECT attempt_number, ip_address, attempted_at FROM failed_login_attempts WHERE email = ? ORDER BY attempted_at DESC LIMIT 3',
      [email]
    );
    
    return attempts;
    
  } catch (error) {
    console.error('❌ Get failed attempts error:', error);
    return [];
  }
}