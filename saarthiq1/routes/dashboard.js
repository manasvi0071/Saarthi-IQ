// backend/routes/dashboard.js
import express from 'express';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/* GET ACTIVE USERS COUNT ONLY */
router.get('/active-users-count', requireAdmin, async (req, res) => {
  try {
    // Get connection manager from app
    const connectionManager = req.app.get('connectionManager');
    
    if (!connectionManager) {
      console.log('❌ Connection manager not available');
      return res.json({
        success: true,
        activeUsersCount: 0,
        timestamp: new Date().toISOString()
      });
    }
    
    // Use getConnectionStatus from your index.js functions
    const status = connectionManager.getConnectionStatus ? 
      connectionManager.getConnectionStatus() : 
      { currentCount: 0 };
    
    res.json({
      success: true,
      activeUsersCount: status.currentCount || 0,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Active users count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active users count'
    });
  }
});

export default router;