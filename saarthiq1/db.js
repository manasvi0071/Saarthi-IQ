// backend/db.js - PRODUCTION READY (Render + DigitalOcean) WITH USER_TYPE & PASSWORD_RESETS SUPPORT
import mysql from 'mysql2/promise';
import 'dotenv/config';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (!process.env.DB_HOST) {
  throw new Error('❌ DB_HOST is not defined');
}

let sslConfig = null;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: Number(process.env.DB_PORT || 3306),
  ssl: sslConfig || undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

async function createReportTables(connection) {
  console.log('🔧 Setting up report & auth system tables...');

  try {
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

    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM users 
      WHERE Field IN ('last_activity', 'total_call_hours', 'login_attempts', 'call_count', 'click_count', 'user_type')
    `);

    const existingColumns = columns.map((c) => c.Field);

    const columnsToAdd = [
      { name: 'last_activity', sql: 'TIMESTAMP NULL DEFAULT NULL' },
      { name: 'total_call_hours', sql: "TIME DEFAULT '00:00:00'" },
      { name: 'login_attempts', sql: 'INT DEFAULT 0' },
      { name: 'call_count', sql: 'INT DEFAULT 0' },
      { name: 'click_count', sql: 'INT DEFAULT 0' },
      { name: 'user_type', sql: "VARCHAR(32) DEFAULT NULL COMMENT 'job_seeker, employer, bd, franchisee, recruitment, admin'" },
    ];

    for (const col of columnsToAdd) {
      if (!existingColumns.includes(col.name)) {
        await connection.execute(`
          ALTER TABLE users ADD COLUMN ${col.name} ${col.sql}
        `);
        console.log(`✅ Added column ${col.name} to users table`);
      }
    }

    await connection.execute(`
      ALTER TABLE users
      ADD UNIQUE INDEX IF NOT EXISTS idx_users_email (email),
      ADD UNIQUE INDEX IF NOT EXISTS idx_users_phone (phone)
    `).catch((err) => {
      if (!/Duplicate key name/.test(err.message)) {
        console.warn('⚠️ Email/phone unique index setup warning:', err.message);
      }
    });

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

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_at DATETIME,
        INDEX idx_email (email),
        INDEX idx_token_hash (token_hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create applications table
await connection.execute(`
  CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    candidate_id INT NOT NULL,
    status ENUM('applied','shortlisted','rejected','interview_scheduled') DEFAULT 'applied',
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_job_id (job_id),
    INDEX idx_candidate_id (candidate_id),
    INDEX idx_status (status),
    FOREIGN KEY (candidate_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`);

// Create interviews table
await connection.execute(`
  CREATE TABLE IF NOT EXISTS interviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    scheduled_time DATETIME NOT NULL,
    mode ENUM('online','offline') DEFAULT 'online',
    status ENUM('scheduled','rescheduled','cancelled','completed') DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_application_id (application_id),
    INDEX idx_status (status),
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`);

    console.log('✅ Database tables ready (reports, auth, password_resets, user_type)');
  } catch (err) {
    console.error('❌ Table setup failed:', err.message);
    throw err;
  }
}

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
