// backend/index.js - UPDATED
import express from 'express';
import path from 'path';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import 'dotenv/config';
import rateLimit from 'express-rate-limit';
import dashboardRouter from './routes/dashboard.js';
import { autoEnableExpiredUsers } from './scripts/autoEnableUsers.js'; // Keep this import
import { connectDB } from './db.js'; 
import { requireAuth } from './middleware/auth.js';

import emailRoutes from './routes/email.js';
import filesRouter from './routes/files.js';
import authRouter from './routes/auth.js';
import crossAuthRouter from './routes/crossAuth.js';
import apiKeysRouter from './routes/apiKeys.js';
import checkUserRouter from './routes/checkUser.js';
import filterRoutes from './routes/filters.js';
import remarkRoutes from './routes/remarks.js';
import profilesRoutes from './routes/profiles.js'; // ADD THIS LINE
import usersRouter from './routes/users.js';
import reportsRouter from './routes/reports.js';
import employerRouter from './routes/employer.js';

const app = express();
const server = http.createServer(app);

/* =========================================================
   ENV & SERVER CONFIG
========================================================= */

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_LOCAL = NODE_ENV !== 'production';
const PORT = process.env.PORT || 3001;
const CONNECTION_LIMIT = 75;

/* =========================================================
   CONNECTION TRACKING SYSTEM - ENHANCED
========================================================= */

const activeConnections = new Map();
const socketToConnectionMap = new Map();
let lastCleanup = Date.now();

function addActiveConnection(connectionId, userData, socketId = null) {
  if (Date.now() - lastCleanup > 60000) {
    cleanupOldConnections();
    lastCleanup = Date.now();
  }
  
  activeConnections.set(connectionId, {
    userId: userData.userId,
    email: userData.email,
    name: userData.name,
    department: userData.department,
    isAdmin: userData.isAdmin || false,
    loginTime: Date.now(),
    lastActivity: Date.now(),
    ip: userData.ip || 'unknown',
    socketId: socketId
  });
  // REMOVE THIS LINE: setupAutoEnableCron(); // ❌ DELETE THIS LINE
  
  if (socketId) {
    socketToConnectionMap.set(socketId, connectionId);
  }
  
  console.log(`✅ Connection added: ${connectionId} (${userData.email}) - Total: ${activeConnections.size}/${CONNECTION_LIMIT}`);
  
  // BROADCAST UPDATE AFTER ADDING
  broadcastConnectionStatus();
  
  return activeConnections.size;
}

function updateConnectionActivity(connectionId) {
  const conn = activeConnections.get(connectionId);
  if (conn) {
    conn.lastActivity = Date.now();
    return true;
  }
  return false;
}

function removeConnection(connectionId) {
  const conn = activeConnections.get(connectionId);
  if (conn) {
    if (conn.socketId) {
      socketToConnectionMap.delete(conn.socketId);
    }
    
    activeConnections.delete(connectionId);
    
    console.log(`❌ Connection removed: ${connectionId} (${conn.email}) - Remaining: ${activeConnections.size}`);
    
    // BROADCAST UPDATE HERE
    broadcastConnectionStatus();
    
    return true;
  }
  
  console.log(`❌ Connection ${connectionId} not found`);
  return false;
}

function cleanupOldConnections() {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30 minutes
  
  let removed = 0;
  for (const [connectionId, conn] of activeConnections.entries()) {
    if (now - conn.lastActivity > timeout) {
      console.log(`🧹 Cleaning inactive connection: ${connectionId} (${conn.email})`);
      removeConnection(connectionId);
      removed++;
    }
  }
  
  if (removed > 0) {
    console.log(`🧹 Cleaned ${removed} inactive connections`);
  }
  
  return removed;
}

function getConnectionStatus() {
  const currentCount = activeConnections.size;
  const warningThreshold = Math.floor(CONNECTION_LIMIT * 0.8);
  const isWarningThreshold = currentCount >= warningThreshold;
  const isLimitReached = currentCount >= CONNECTION_LIMIT;
  
  return {
    currentCount,
    maxConnections: CONNECTION_LIMIT,
    warningThreshold,
    isWarningThreshold,
    isLimitReached,
    remainingConnections: Math.max(0, CONNECTION_LIMIT - currentCount),
    activeUsers: Array.from(activeConnections.values()).map(c => ({
      userId: c.userId,
      email: c.email,
      name: c.name,
      department: c.department,
      isAdmin: c.isAdmin,
      loginTime: c.loginTime,
      lastActivity: c.lastActivity,
      sessionDuration: Math.floor((Date.now() - c.loginTime) / 60000) // minutes
    }))
  };
}

// REMOVE THESE LINES (103-109): ❌ DELETE THIS ENTIRE BLOCK
// Run every hour
// setInterval(() => {
//   autoEnableExpiredUsers();
// }, 60 * 60 * 1000); // 1 hour
// autoEnableExpiredUsers();

// Export functions for use in auth routes
export { 
  addActiveConnection, 
  updateConnectionActivity, 
  removeConnection, 
  getConnectionStatus,
  activeConnections 
};

// Set connection manager in app
app.set('connectionManager', {
  addActiveConnection,
  updateConnectionActivity,
  removeConnection,
  getConnectionStatus,
  activeConnections
});

/* =========================================================
   SECURITY HEADERS
========================================================= */

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

/* =========================================================
   RATE LIMITING
========================================================= */

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_LOCAL ? 1000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const ip = req.ip || '';
    return ip.includes('127.0.0.1') || ip === '::1';
  },
});

app.use('/api', limiter);

/* =========================================================
   CORS CONFIG
========================================================= */

const allowedOrigins = [
  'https://www.saarthiq.in',
  'https://saarthiq.in',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://www.sarthi360.in', 
  'https://sarthi360.in',    
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition']
}));

app.options('*', cors());

/* =========================================================
   SOCKET.IO CONFIG - ENHANCED
========================================================= */

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  }
});

app.set('io', io);

const activeSockets = {};

const broadcastConnectionStatus = () => {
  const status = getConnectionStatus();
  
  // Broadcast to all clients
  io.emit('connectionCountUpdate', {
    count: status.currentCount,
    status: status
  });
  
  // Broadcast detailed info to admin room
  io.to('admin').emit('adminConnectionUpdate', {
    count: status.currentCount,
    status: status,
    activeUsers: status.activeUsers,
    timestamp: new Date().toISOString()
  });
  
  console.log(`📊 Connection broadcast: ${status.currentCount}/${CONNECTION_LIMIT} users`);
};

// Connection status broadcast interval
setInterval(broadcastConnectionStatus, 30000); // Every 30 seconds

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  activeSockets[socket.id] = { connectedAt: new Date() };
  
  socket.on('userConnected', (userData) => {
    console.log(`👤 User connected via socket: ${userData?.name} (${userData?.department})`);
    
    activeSockets[socket.id] = {
      ...activeSockets[socket.id],
      name: userData?.name,
      department: userData?.department,
      isAdmin: !!userData?.isAdmin,
      userId: userData?.userId
    };
    
    // Join department room
    if (userData?.department) {
      socket.join(`dept_${userData.department}`);
    }
    
    // Join admin room if admin
    if (userData?.isAdmin) {
      socket.join('admin');
      console.log(`👑 Admin connected: ${userData.name}`);
    }
    
    // Link socket to connection
    if (userData?.connectionId) {
      const connection = activeConnections.get(userData.connectionId);
      if (connection) {
        connection.socketId = socket.id;
        connection.lastActivity = Date.now();
        socketToConnectionMap.set(socket.id, userData.connectionId);
        console.log(`🔗 Socket ${socket.id} linked to connection ${userData.connectionId}`);
      }
    }
    
    // Initial broadcast
    broadcastConnectionStatus();
  });
  
  socket.on('updateConnectionActivity', (data) => {
    if (data.connectionId) {
      updateConnectionActivity(data.connectionId);
    }
  });
  
  socket.on('ping', () => {
    socket.emit('pong', { 
      time: Date.now(),
      serverTime: new Date().toISOString()
    });
    
    const connectionId = socketToConnectionMap.get(socket.id);
    if (connectionId) {
      updateConnectionActivity(connectionId);
    }
  });
  
  socket.on('userLogout', (data) => {
    if (data.connectionId) {
      console.log(`👋 User logout via socket: ${data.connectionId}`);
      removeConnection(data.connectionId);
      broadcastConnectionStatus();
    }
  });
  
  // Disconnect handler - UPDATED
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
    
    // Find and remove associated connection
    const connectionId = socketToConnectionMap.get(socket.id);
    if (connectionId) {
      console.log(`Removing connection ${connectionId} due to socket disconnect`);
      const removed = removeConnection(connectionId);
      
      if (removed) {
        // Emit logout event
        io.emit('userLogout', { 
          connectionId,
          reason: 'disconnect',
          timestamp: new Date().toISOString()
        });
      }
    } else {
      console.log(`No connection found for socket ${socket.id}`);
    }
    
    delete activeSockets[socket.id];
    socketToConnectionMap.delete(socket.id);
    
    // BROADCAST STATUS UPDATE
    broadcastConnectionStatus();
  });

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error);
  });
});

/* =========================================================
   BODY PARSERS & LOGGING
========================================================= */

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  console.log(
    `[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`
  );
  next();
});


/* =========================================================
   API ROUTES
========================================================= */
app.use('/api/dashboard', dashboardRouter);
app.use('/api/auth', authRouter);
app.use('/api/files', filesRouter);
app.use('/api/filters', filterRoutes);
app.use('/api/remarks', remarkRoutes);
app.use('/api/auth', checkUserRouter);
app.use('/api/cross-auth', crossAuthRouter);
app.use('/api/profiles', profilesRoutes); // ADD THIS LINE
app.use('/api/users', usersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/employer', employerRouter);
app.use('/api/email', emailRoutes);
app.use('/api/api-keys', apiKeysRouter);

app.get('/api/config', (req, res) => {
  res.json({ apiUrl: process.env.API_URL });
});

/* =========================================================
   SAARTHIQ CANDIDATE COUNT ENDPOINT
   Called by sarthi360 Enquiry form to show live candidate
   count for a given designation before submitting.
========================================================= */
app.get('/api/saarthiq/count', async (req, res) => {
  try {
    const { designation } = req.query;

    if (!designation || designation.trim().length < 2) {
      return res.json({ count: 0 });
    }

    // MySQL: uses ? placeholders, LIKE (not ILIKE), pool is default export
    const dbPool = (await import('./db.js')).default;
    const searchTerm = `%${designation.trim()}%`;
    const [rows] = await dbPool.query(
      `SELECT COUNT(*) AS count
       FROM profiles
       WHERE designation LIKE ?`,
      [searchTerm]
    );

    const count = parseInt(rows[0].count, 10);
    res.json({ count });

  } catch (error) {
    console.error('Saarthiq count error:', error);
    res.status(500).json({ error: 'Failed to fetch candidate count' });
  }
});

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

/* =========================================================
   CONNECTION MANAGEMENT ENDPOINTS
========================================================= */

// Public connection status endpoint
app.get('/api/connection-status', (req, res) => {
  try {
    const status = getConnectionStatus();
    
    res.json({
      success: true,
      connectionStatus: {
        currentCount: status.currentCount,
        maxConnections: status.maxConnections,
        warningThreshold: status.warningThreshold,
        isWarningThreshold: status.isWarningThreshold,
        isLimitReached: status.isLimitReached,
        remainingConnections: status.remainingConnections,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Connection status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get connection status'
    });
  }
});

// Admin-only connection details
app.get('/api/admin/connection-details', (req, res) => {
  try {
    const status = getConnectionStatus();
    
    res.json({
      success: true,
      connectionStatus: status,
      activeConnections: Array.from(activeConnections.entries()).map(([id, conn]) => ({
        connectionId: id,
        userId: conn.userId,
        email: conn.email,
        name: conn.name,
        department: conn.department,
        isAdmin: conn.isAdmin,
        loginTime: conn.loginTime,
        lastActivity: conn.lastActivity,
        ip: conn.ip,
        sessionDuration: Math.floor((Date.now() - conn.loginTime) / 60000) + ' minutes',
        socketId: conn.socketId,
        status: conn.socketId ? 'active' : 'no-socket'
      })),
      socketStats: {
        totalSockets: Object.keys(activeSockets).length,
        activeSockets: Object.keys(activeSockets)
      }
    });
  } catch (error) {
    console.error('Connection details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get connection details'
    });
  }
});

// Force disconnect endpoint
app.post('/api/admin/disconnect-user', (req, res) => {
  try {
    const { connectionId } = req.body;
    
    if (!connectionId) {
      return res.status(400).json({
        success: false,
        message: 'Connection ID is required'
      });
    }
    
    const removed = removeConnection(connectionId);
    
    if (removed) {
      io.to('admin').emit('userForceDisconnected', {
        connectionId,
        timestamp: new Date().toISOString(),
        byAdmin: true
      });
      
      broadcastConnectionStatus();
      
      res.json({
        success: true,
        message: `Connection ${connectionId} disconnected`
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }
  } catch (error) {
    console.error('Force disconnect error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect user'
    });
  }
});

/* =========================================================
   ROOT ENDPOINT
========================================================= */

app.get('/', (req, res) => {
  const status = getConnectionStatus();
  
  res.json({
    message: 'Talent Corner Backend API',
    environment: NODE_ENV,
    server: `http://localhost:${PORT}`,
    timestamp: new Date().toISOString(),
    connectionStatus: {
      active: status.currentCount,
      limit: status.maxConnections,
      remaining: status.remainingConnections,
      isWarning: status.isWarningThreshold,
      isLimitReached: status.isLimitReached
    },
    endpoints: {
      auth: '/api/auth',
      files: '/api/files',
      filters: '/api/filters',
      users: '/api/users',
      reports: '/api/reports',
      connectionStatus: '/api/connection-status',
      health: '/api/auth/health'
    }
  });
});

/* =========================================================
   404 & ERROR HANDLERS
========================================================= */

app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method 
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  res.status(500).json({
    message: 'Internal Server Error',
    error: IS_LOCAL ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

/* =========================================================
   START SERVER
========================================================= */

// Regular cleanup of inactive connections
setInterval(() => {
  cleanupOldConnections();
}, 5 * 60 * 1000); // Every 5 minutes

// Initialize database and tables
console.log('🔧 Initializing database tables...');
connectDB().then(() => {
  console.log('✅ Database initialized with tables');
}).catch(error => {
  console.error('❌ Failed to initialize database:', error.message);
});

// Run auto-enable on startup
autoEnableExpiredUsers().then(() => {
  console.log('✅ Auto-enable task ran on startup');
}).catch(err => {
  console.error('❌ Auto-enable task failed on startup:', err);
});

// Set up hourly auto-enable
const autoEnableInterval = setInterval(() => {
  autoEnableExpiredUsers();
}, 60 * 60 * 1000); // 1 hour

console.log('✅ Auto-enable cron job scheduled (runs hourly)');

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║       Talent Corner Server Started                    ║
╠═══════════════════════════════════════════════════════╣
║  Server:    http://localhost:${PORT}                  ║
║  Env:       ${NODE_ENV}                               ║
║  Limit:     ${CONNECTION_LIMIT} concurrent users      ║
║  Socket.IO: Enabled                                   ║
║  Time:      ${new Date().toLocaleString()}            ║
║  Auto-Enable: Scheduled (hourly)                      ║
╚═══════════════════════════════════════════════════════╝
  `);
  
  console.log(`CORS enabled for: ${allowedOrigins.join(', ')}`);
});