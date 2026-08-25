// backend/middleware/auth.js - UPDATED FOR MINIMAL EMAILS
import jwt from 'jsonwebtoken';
import { connectDB } from '../db.js';

// ============ CORE MIDDLEWARE FUNCTIONS ============

// Simple input sanitization middleware
export function sanitizeInput(req, res, next) {
  const sanitize = (value) => {
    if (typeof value === 'string') {
      // Trim and remove dangerous tags
      return value.trim().replace(/<[^>]*>/g, '');
    }
    if (Array.isArray(value)) return value.map(sanitize);
    if (value && typeof value === 'object') {
      const out = {};
      for (const k of Object.keys(value)) out[k] = sanitize(value[k]);
      return out;
    }
    return value;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  next();
}

// Very basic SQL injection detection
export function sqlInjectionCheck(req, res, next) {
  const suspicious = /(--|;|\bOR\b|\bAND\b|\bDROP\b|\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b|\bEXEC\b|\bEXECUTE\b|\bTRUNCATE\b|\bCREATE\b|\bALTER\b|\bSHUTDOWN\b)/i;

  const check = (obj) => {
    for (const k of Object.keys(obj || {})) {
      const v = obj[k];
      if (typeof v === 'string' && suspicious.test(v)) {
        console.warn(`⚠️ SQL injection attempt detected: ${v.substring(0, 50)}`);
        return true;
      }
    }
    return false;
  };

  if (check(req.body) || check(req.query) || check(req.params)) {
    return res.status(400).json({ 
      success: false,
      message: 'Potentially unsafe characters detected' 
    });
  }

  next();
}

// Middleware: Require authentication via JWT
export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication token required' 
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    console.error('JWT verification error:', err.message);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired. Please log in again.',
        expired: true
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token. Please log in again.',
        invalid: true
      });
    }
    
    return res.status(401).json({ 
      success: false,
      message: 'Authentication failed'
    });
  }
}

// Middleware: Require admin privileges
export function requireAdmin(req, res, next) {
  try {
    if (!req.user) return requireAuth(req, res, next);
    
    // Check if user has admin privileges
    const isAdmin = req.user.is_admin === true || req.user.is_admin === 1 || 
                   (req.user.actual_department === 'Admin' && req.user.is_admin !== false);
    
    if (isAdmin) {
      return next();
    }
    
    return res.status(403).json({ 
      success: false,
      message: 'Admin access required',
      userRole: req.user.is_admin ? 'admin' : 'user',
      userDepartment: req.user.department
    });
    
  } catch (err) {
    console.error('Admin check error:', err);
    return res.status(403).json({ 
      success: false,
      message: 'Admin access required'
    });
  }
}

// Password strength validator
export function validatePasswordStrength(password, mode = 'strict') {
  if (!password || typeof password !== 'string') {
    return 'Password required';
  }
  
  // Trim and check minimum length
  const trimmedPassword = password.trim();
  
  if (trimmedPassword.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  
  // Check for common weak passwords
  const weakPasswords = [
    'password', '12345678', 'qwertyui', 'admin123', 'welcome1',
    'password123', 'abc12345', 'letmein1', 'monkey12', 'sunshine'
  ];
  
  if (weakPasswords.includes(trimmedPassword.toLowerCase())) {
    return 'Password is too common. Please choose a stronger password';
  }
  
  const rules = [
    { ok: trimmedPassword.length >= 8, msg: 'At least 8 characters' },
    { ok: /[A-Z]/.test(trimmedPassword), msg: 'One uppercase letter' },
    { ok: /[a-z]/.test(trimmedPassword), msg: 'One lowercase letter' },
    { ok: /[0-9]/.test(trimmedPassword), msg: 'One number' },
    { ok: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(trimmedPassword), msg: 'One special character' }
  ];

  const failed = rules.filter(r => !r.ok).map(r => r.msg);
  
  if (failed.length === 0) return '';
  
  // In 'strict' mode, require all rules; otherwise return first failed rule
  if (mode === 'strict') {
    return failed.join(', ');
  } else {
    return failed[0] || 'Password does not meet requirements';
  }
}

// Brute force protection (simple in-memory per-IP tracker)
const ipAttempts = new Map();
const IP_ATTEMPT_LIMIT = parseInt(process.env.IP_ATTEMPT_LIMIT || '100', 10);
const IP_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function bruteForceProtection(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  
  if (!ipAttempts.has(ip)) {
    ipAttempts.set(ip, []);
  }

  // Clean old attempts
  const now = Date.now();
  const attempts = ipAttempts.get(ip).filter(ts => now - ts < IP_ATTEMPT_WINDOW_MS);
  attempts.push(now);
  ipAttempts.set(ip, attempts);

  // Attach helper object to req.bruteForce
  req.bruteForce = {
    recordFailure: () => {
      // Already recorded above
    },
    recordSuccess: () => {
      ipAttempts.delete(ip);
    },
    getRemainingAttempts: () => Math.max(0, IP_ATTEMPT_LIMIT - attempts.length),
    getResetTime: () => {
      if (attempts.length === 0) return 0;
      const oldestAttempt = attempts[0];
      return Math.ceil((oldestAttempt + IP_ATTEMPT_WINDOW_MS - now) / 1000);
    }
  };

  if (attempts.length > IP_ATTEMPT_LIMIT) {
    const resetTime = Math.ceil((attempts[0] + IP_ATTEMPT_WINDOW_MS - now) / 1000);
    
    return res.status(429).json({ 
      success: false,
      message: `Too many requests from your IP. Please try again in ${resetTime} seconds.`,
      retryAfter: resetTime,
      limit: IP_ATTEMPT_LIMIT,
      window: Math.floor(IP_ATTEMPT_WINDOW_MS / 60000) + ' minutes'
    });
  }

  next();
}

// ============ HELPER FUNCTIONS ============

/**
 * Validate email format
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (Indian format)
 */
export function validatePhone(phone) {
  if (!phone) return false;
  
  // Remove all non-digits
  const cleanPhone = phone.toString().replace(/\D/g, '');
  
  // Check if it's exactly 10 digits and starts with 6-9
  if (cleanPhone.length !== 10) return false;
  
  // Indian mobile numbers start with 6, 7, 8, or 9
  return /^[6-9]\d{9}$/.test(cleanPhone);
}

/**
 * Format phone number to standard Indian format
 */
export function formatPhone(phone) {
  if (!phone) return '';
  
  const cleanPhone = phone.toString().replace(/\D/g, '');
  
  if (cleanPhone.length === 10) {
    return `+91 ${cleanPhone.substring(0, 5)} ${cleanPhone.substring(5)}`;
  }
  
  return phone;
}

// Clean up IP attempts periodically
setInterval(() => {
  const now = Date.now();
  
  for (const [ip, attempts] of ipAttempts.entries()) {
    const filtered = attempts.filter(time => now - time < IP_ATTEMPT_WINDOW_MS);
    
    if (filtered.length === 0) {
      ipAttempts.delete(ip);
    } else {
      ipAttempts.set(ip, filtered);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes