import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { generateApiKey, hashApiKey } from '../middleware/apiKeyAuth.js';

const router = express.Router();

/**
 * ✅ GENERATE NEW API KEY
 * POST /api/api-keys/generate
 */
router.post('/generate', requireAuth, async (req, res) => {
  try {
    console.log(`🔑 Generate API key request from user ${req.user.id}`);
    
    const { key_name, description, expires_in_days, permissions } = req.body;
    const userId = req.user.id;

    if (!key_name) {
      return res.status(400).json({
        success: false,
        message: 'key_name is required'
      });
    }

    // Generate new API key
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 20);

    // Calculate expiration date
    let expiresAt = null;
    if (expires_in_days && expires_in_days > 0) {
      const date = new Date();
      date.setDate(date.getDate() + expires_in_days);
      expiresAt = date;
    }

    const keyPermissions = permissions || ['read'];
    const permissionsJSON = JSON.stringify(keyPermissions);

    console.log(`📝 Inserting API key for user ${userId}`);
    console.log(`   Key Name: ${key_name}`);
    console.log(`   Permissions: ${permissionsJSON}`);
    console.log(`   Expires At: ${expiresAt}`);

    // Insert into database
    const [result] = await pool.execute(
      `INSERT INTO api_keys 
       (user_id, key_hash, key_prefix, key_name, description, permissions, expires_at, is_active, usage_count) 
       VALUES (?, ?, ?, ?, ?, ?, ?, true, 0)`,
      [
        userId,
        keyHash,
        keyPrefix,
        key_name,
        description || null,
        permissionsJSON,
        expiresAt
      ]
    );

    console.log(`✅ API key created successfully with ID: ${result.insertId}`);

    res.status(201).json({
      success: true,
      message: 'API key generated successfully',
      data: {
        id: result.insertId,
        api_key: apiKey,
        key_prefix: keyPrefix,
        key_name,
        description,
        permissions: keyPermissions,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        warning: '⚠️ Save this key in a safe place. You won\'t see it again!'
      }
    });

  } catch (error) {
    console.error('❌ Generate API key error:', error.message);
    console.error('   Full error:', error);
    console.error('   SQL:', error.sql);
    res.status(500).json({
      success: false,
      message: 'Failed to generate API key',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * ✅ GET ALL API KEYS FOR USER
 * GET /api/api-keys
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`📋 Fetching API keys for user ${userId}`);

    const [rows] = await pool.execute(
      `SELECT 
        id, 
        key_prefix, 
        key_name, 
        description, 
        permissions, 
        created_at, 
        expires_at, 
        last_used_at, 
        usage_count, 
        is_active 
       FROM api_keys 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [userId]
    );

    console.log(`✅ Found ${rows.length} API keys for user ${userId}`);

    const formattedRows = rows.map(key => {
      let permissions = ['read']; // Default
      
      if (key.permissions) {
        try {
          // Check if it's already a string representation
          if (typeof key.permissions === 'string') {
            // If it's a plain string like "read", convert to array
            if (key.permissions.startsWith('[')) {
              permissions = JSON.parse(key.permissions);
            } else {
              permissions = [key.permissions];
            }
          } else if (Array.isArray(key.permissions)) {
            permissions = key.permissions;
          }
        } catch (e) {
          console.warn(`⚠️ Failed to parse permissions for key ${key.id}: ${key.permissions}`);
          permissions = ['read'];
        }
      }
      
      return {
        id: key.id,
        key_prefix: key.key_prefix,
        key_name: key.key_name,
        description: key.description,
        permissions: permissions,
        created_at: key.created_at,
        expires_at: key.expires_at,
        last_used_at: key.last_used_at,
        usage_count: key.usage_count,
        is_active: key.is_active
      };
    });

    res.json({
      success: true,
      data: formattedRows
    });

  } catch (error) {
    console.error('❌ Fetch API keys error:', error.message);
    console.error('   Full error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch API keys',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * ✅ GET SPECIFIC API KEY
 * GET /api/api-keys/:id
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`📋 Fetching API key ${id} for user ${userId}`);

    const [rows] = await pool.execute(
      `SELECT * FROM api_keys WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    const key = rows[0];
    let permissions = ['read'];
    
    if (key.permissions) {
      try {
        if (typeof key.permissions === 'string') {
          if (key.permissions.startsWith('[')) {
            permissions = JSON.parse(key.permissions);
          } else {
            permissions = [key.permissions];
          }
        } else if (Array.isArray(key.permissions)) {
          permissions = key.permissions;
        }
      } catch (e) {
        console.warn(`⚠️ Failed to parse permissions for key ${key.id}`);
        permissions = ['read'];
      }
    }

    res.json({
      success: true,
      data: {
        ...key,
        permissions: permissions
      }
    });

  } catch (error) {
    console.error('❌ Fetch API key error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch API key'
    });
  }
});

/**
 * ✅ REVOKE API KEY
 * PATCH /api/api-keys/:id/revoke
 */
router.patch('/:id/revoke', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🔒 Revoking API key ${id} for user ${userId}`);

    const [rows] = await pool.execute(
      `SELECT id FROM api_keys WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    await pool.execute(
      `UPDATE api_keys SET is_active = false WHERE id = ?`,
      [id]
    );

    console.log(`✅ API key ${id} revoked`);

    res.json({
      success: true,
      message: 'API key revoked successfully'
    });

  } catch (error) {
    console.error('❌ Revoke API key error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke API key'
    });
  }
});

/**
 * ��� DELETE API KEY
 * DELETE /api/api-keys/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🗑️ Deleting API key ${id} for user ${userId}`);

    const [rows] = await pool.execute(
      `SELECT id FROM api_keys WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    // Delete usage logs first (foreign key constraint)
    await pool.execute(`DELETE FROM api_key_usage WHERE api_key_id = ?`, [id]);

    // Then delete the key
    await pool.execute(`DELETE FROM api_keys WHERE id = ?`, [id]);

    console.log(`✅ API key ${id} deleted`);

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete API key error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete API key'
    });
  }
});

/**
 * ✅ GET API KEY USAGE STATISTICS
 * GET /api/api-keys/:id/usage
 */
router.get('/:id/usage', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`📊 Fetching usage for API key ${id} for user ${userId}`);

    // Verify key belongs to user
    const [keyRows] = await pool.execute(
      `SELECT id FROM api_keys WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (keyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    // Get usage by endpoint
    const [usageRows] = await pool.execute(
      `SELECT 
        endpoint, 
        method, 
        COUNT(*) as count, 
        MAX(used_at) as last_used
       FROM api_key_usage 
       WHERE api_key_id = ? 
       GROUP BY endpoint, method
       ORDER BY last_used DESC`,
      [id]
    );

    // Get total calls
    const [totalUsage] = await pool.execute(
      `SELECT COUNT(*) as total_calls FROM api_key_usage WHERE api_key_id = ?`,
      [id]
    );

    console.log(`✅ Found ${totalUsage[0].total_calls} total calls for API key ${id}`);

    res.json({
      success: true,
      data: {
        total_calls: totalUsage[0].total_calls,
        endpoints: usageRows
      }
    });

  } catch (error) {
    console.error('❌ Fetch API usage error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch API usage'
    });
  }
});

export default router;