// backend/db.js - PRODUCTION READY (Render + DigitalOcean)
import mysql from 'mysql2/promise';
import 'dotenv/config';

/* =========================================================
   ENV CHECK
========================================================= */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (!process.env.DB_HOST) {
  throw new Error('❌ DB_HOST is not defined');
}

/* =========================================================
   SSL CONFIG FOR DIGITALOCEAN
========================================================= */

let sslConfig = null;

// Uncomment and configure this for DigitalOcean/Render if needed
// if (IS_PRODUCTION && process.env.DB_SSL_CA) {
//   sslConfig = {
//     ca: process.env.DB_SSL_CA
//   };
// }

/* =========================================================
   CREATE CONNECTION POOL
========================================================= */

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: Number(process.env.DB_PORT || 3306), // Default MySQL port is 3306, not 25060
  ssl: sslConfig || undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

/* =========================================================
   REPORT SYSTEM TABLE SETUP
========================================================= */

async function createReportTables(connection) {
  console.log('🔧 Setting up report system tables...');

  try {
    // Create activity_logs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        profile_id VARCHAR(50) NOT NULL,
        department ENUM('BD', 'Recruit', 'Franchise', 'Admin') NOT NULL,
        status ENUM('in-progress', 'cancelled', 'closed', 'follow-up', 'pending') NOT NULL,
        duration TIME NOT NULL,
        note TEXT,
        candidate_location VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_name_update TINYINT(1) DEFAULT 0,
        INDEX idx_user_id (user_id),
        INDEX idx_department (department),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        INDEX idx_profile_id (profile_id),
        INDEX idx_candidate_location (candidate_location),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create contact_views table (this is what your code uses, not report_views)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS contact_views (
        id INT AUTO_INCREMENT PRIMARY KEY,
        profile_id INT NOT NULL,
        viewer_user_id INT NOT NULL,
        viewer_name VARCHAR(100) NOT NULL,
        viewer_department VARCHAR(100) NOT NULL,
        viewed_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT NULL,
        viewed_date DATE GENERATED ALWAYS AS (CAST(viewed_at AS DATE)) STORED,
        INDEX idx_profile_id (profile_id),
        INDEX idx_viewer_user_id (viewer_user_id),
        INDEX idx_viewed_at (viewed_at),
        INDEX idx_viewer_dept (viewer_department),
        INDEX idx_viewed_date (viewed_date),
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (viewer_user_id) REFERENCES users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create login_logs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS login_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT,
        INDEX idx_user_id (user_id),
        INDEX idx_login_time (login_time),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Check and add columns to users table if they don't exist
    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM users 
      WHERE Field IN ('last_activity', 'total_call_hours', 'login_attempts', 'call_count', 'click_count')
    `);

    const existingColumns = columns.map(c => c.Field);

    const columnsToAdd = [
      { name: 'last_activity', sql: 'TIMESTAMP NULL DEFAULT NULL' },
      { name: 'total_call_hours', sql: "TIME DEFAULT '00:00:00'" },
      { name: 'login_attempts', sql: 'INT DEFAULT 0' },
      { name: 'call_count', sql: 'INT DEFAULT 0' },
      { name: 'click_count', sql: 'INT DEFAULT 0' }
    ];

    for (const col of columnsToAdd) {
      if (!existingColumns.includes(col.name)) {
        await connection.execute(`
          ALTER TABLE users ADD COLUMN ${col.name} ${col.sql}
        `);
        console.log(`✅ Added column ${col.name} to users table`);
      }
    }

    // Create pending_users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS pending_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        department VARCHAR(50) NOT NULL,
        phone VARCHAR(20),
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
// Create api_keys table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        key_hash VARCHAR(255) NOT NULL UNIQUE,
        key_prefix VARCHAR(20) NOT NULL,
        key_name VARCHAR(100) NOT NULL,
        description TEXT,
        permissions JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        last_used_at DATETIME,
        is_active BOOLEAN DEFAULT true,
        usage_count INT DEFAULT 0,
        INDEX idx_user_id (user_id),
        INDEX idx_key_hash (key_hash),
        INDEX idx_is_active (is_active),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create api_key_usage table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS api_key_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        api_key_id INT NOT NULL,
        endpoint VARCHAR(255),
        method VARCHAR(10),
        status_code INT,
        used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        response_time_ms INT,
        INDEX idx_api_key_id (api_key_id),
        INDEX idx_used_at (used_at),
        INDEX idx_endpoint (endpoint),
        FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Database tables ready');

  } catch (err) {
    console.error('❌ Table setup failed:', err.message);
    throw err;
  }
}

/* =========================================================
   CONNECT DB
========================================================= */

export async function connectDB() {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.ping();

    const [rows] = await connection.query('SELECT DATABASE() AS db');
    console.log(`✅ Connected to MySQL: ${rows[0].db}`);

    await createReportTables(connection);

    connection.release();
    return pool;

  } catch (err) {
    console.error('❌ Database connection error:', err.message);

    if (connection) {
      try {
        connection.release();
      } catch {}
    }

    throw err;
  }
}

export default pool;
