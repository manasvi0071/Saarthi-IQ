// scripts/optimize-database.js
// Run this script once to add database indexes for better filter performance

import 'dotenv/config';
import mysql from 'mysql2/promise';

async function optimizeDatabase() {
  console.log('🚀 Starting database optimization...\n');

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 5
  });

  try {
    const connection = await pool.getConnection();
    console.log('✅ Connected to database\n');

    // Get table size info
    const [tableStats] = await connection.query(`
      SELECT 
        TABLE_NAME,
        TABLE_ROWS,
        ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS 'Size (MB)'
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'profiles'
    `, [process.env.DB_DATABASE]);

    console.log('📊 Table Statistics:');
    console.table(tableStats);
    console.log('');

    // Get existing indexes
    const [existingIndexes] = await connection.query(`
      SHOW INDEX FROM profiles
    `);
    
    const existingIndexNames = new Set(existingIndexes.map(idx => idx.Key_name));
    console.log('📋 Existing indexes:', Array.from(existingIndexNames).join(', '));
    console.log('');

    const indexesToAdd = [
      { name: 'idx_location', sql: 'CREATE INDEX idx_location ON profiles (current_location)' },
      { name: 'idx_gender', sql: 'CREATE INDEX idx_gender ON profiles (gender)' },
      { name: 'idx_industry', sql: 'CREATE INDEX idx_industry ON profiles (industry)' },
      { name: 'idx_designation', sql: 'CREATE INDEX idx_designation ON profiles (designation)' },
      { name: 'idx_company_name', sql: 'CREATE INDEX idx_company_name ON profiles (company_name)' },
      { name: 'idx_age', sql: 'CREATE INDEX idx_age ON profiles (age)' },
      { name: 'idx_alphabet', sql: 'CREATE INDEX idx_alphabet ON profiles (alphabet)' },
      { name: 'idx_name', sql: 'CREATE INDEX idx_name ON profiles (name)' },
      { name: 'idx_total_experience', sql: 'CREATE INDEX idx_total_experience ON profiles (total_experience)' },
      { name: 'idx_annual_salary', sql: 'CREATE INDEX idx_annual_salary ON profiles (annual_salary)' },
      // Composite indexes for common filter combinations
      { name: 'idx_location_gender', sql: 'CREATE INDEX idx_location_gender ON profiles (current_location, gender)' },
      { name: 'idx_location_industry', sql: 'CREATE INDEX idx_location_industry ON profiles (current_location, industry)' },
      { name: 'idx_location_designation', sql: 'CREATE INDEX idx_location_designation ON profiles (current_location, designation)' },
      { name: 'idx_industry_gender', sql: 'CREATE INDEX idx_industry_gender ON profiles (industry, gender)' },
      { name: 'idx_company_location', sql: 'CREATE INDEX idx_company_location ON profiles (company_name, current_location)' }
    ];

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const index of indexesToAdd) {
      if (existingIndexNames.has(index.name)) {
        console.log(`⏭️  Skipping: ${index.name} (already exists)`);
        skipped++;
        continue;
      }

      try {
        console.log(`⏳ Creating: ${index.name}...`);
        await connection.execute(index.sql);
        console.log(`✅ Created: ${index.name}`);
        created++;
      } catch (err) {
        console.error(`❌ Error creating ${index.name}:`, err.message);
        errors++;
      }
    }

    console.log('\n📊 Index Creation Summary:');
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);

    // Analyze tables to update statistics
    console.log('\n📈 Analyzing tables...');
    await connection.execute('ANALYZE TABLE profiles');
    console.log('✅ Table analysis complete');

    // Show index usage statistics
    const [indexUsage] = await connection.query(`
      SELECT 
        INDEX_NAME,
        SEQ_IN_INDEX,
        COLUMN_NAME,
        CARDINALITY
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'profiles'
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `, [process.env.DB_DATABASE]);

    console.log('\n📋 Current Index Structure:');
    console.table(indexUsage);

    connection.release();
    await pool.end();

    console.log('\n✅ Database optimization complete!\n');
    console.log('💡 Expected performance improvements:');
    console.log('   • Location filter: 15s → 1-3s (80-90% faster)');
    console.log('   • Combined filters: 5-10s → 1-2s (70-85% faster)');
    console.log('   • Cascading options: 3-5s → 0.5-1s (80% faster)');

  } catch (err) {
    console.error('❌ Optimization failed:', err.message);
    process.exit(1);
  }
}

optimizeDatabase();
