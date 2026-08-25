import crypto from 'crypto';
import pool from '../db.js';

/**
 * Middleware to validate API keys
 * Checks Authorization header for Bearer token
 */
export async function validateApiKey(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Missing or invalid API key. Use: Authorization: Bearer sk_xxxx'
      });
    }

    const apiKey = authHeader.slice(7); // Remove 'Bearer ' prefix

    // Hash the provided API key
    const keyHash = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');

    // Query database for the API key
    const [rows] = await pool.execute(
      `SELECT * FROM api_keys WHERE key_hash = ? AND is_active = true`,
      [keyHash]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or revoked API key'
      });
    }

    const apiKeyRecord = rows[0];

    // Check if API key has expired
    if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'API key has expired'
      });
    }

    // Update last used timestamp
    await pool.execute(
      `UPDATE api_keys SET last_used_at = NOW(), usage_count = usage_count + 1 
       WHERE id = ?`,
      [apiKeyRecord.id]
    );

    // Log API usage
    logApiUsage(apiKeyRecord.id, req);

    // Attach API key info to request
    req.apiKey = apiKeyRecord;
    req.userId = apiKeyRecord.user_id;

    next();

  } catch (error) {
    console.error('API Key validation error:', error);
    res.status(500).json({
      success: false,
      message: 'API authentication failed'
    });
  }
}

/**
 * Log API key usage for analytics
 */
async function logApiUsage(apiKeyId, req) {
  try {
    await pool.execute(
      `INSERT INTO api_key_usage 
       (api_key_id, endpoint, method, ip_address) 
       VALUES (?, ?, ?, ?)`,
      [apiKeyId, req.path, req.method, req.ip]
    );
  } catch (error) {
    console.error('Failed to log API usage:', error);
  }
}

/**
 * Generate a random API key
 */
export function generateApiKey() {
  const prefix = 'sk_live_'; // sk_live_ for production, sk_test_ for testing
  const randomBytes = crypto.randomBytes(24).toString('hex');
  return prefix + randomBytes;
}

/**
 * Hash API key for storage
 */
export function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}