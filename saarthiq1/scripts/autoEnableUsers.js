import { connectDB } from '../db.js';

async function autoEnableExpiredUsers() {
  try {
    console.log('🚀 Starting auto-enable expired users task...');
    
    const db = await connectDB();
    
    // Find users whose enabled_until date has passed
    const [expiredUsers] = await db.execute(`
      SELECT id, name, email, employee_id 
      FROM users 
      WHERE is_enabled = 0 
        AND enabled_until IS NOT NULL 
        AND enabled_until <= NOW()
    `);
    
    if (expiredUsers.length === 0) {
      console.log('✅ No users to auto-enable');
      return;
    }
    
    console.log(`📋 Found ${expiredUsers.length} user(s) to auto-enable`);
    
    let enabledCount = 0;
    
    for (const user of expiredUsers) {
      try {
        // Enable the user
        await db.execute(
          'UPDATE users SET is_enabled = 1, enabled_until = NULL, disabled_at = NULL, disabled_by = NULL, disabled_reason = NULL WHERE id = ?',
          [user.id]
        );
        
        // Create notification for the user
        await db.execute(
          `INSERT INTO notifications (type, title, user_id, data, \`read\`, created_at)
           VALUES (?, ?, ?, ?, 0, NOW())`,
          ['account_auto_enabled', 'Account Auto-Enabled', user.id, JSON.stringify({
            reason: 'Auto-enabled after disable period expired',
            timestamp: new Date().toISOString()
          })]
        );
        
        console.log(`✅ Auto-enabled user: ${user.name} (${user.email})`);
        enabledCount++;
      } catch (userError) {
        console.error(`❌ Error enabling user ${user.email}:`, userError);
      }
    }
    
    console.log(`🎉 Auto-enabled ${enabledCount} user(s) successfully`);
    
  } catch (error) {
    console.error('❌ Auto-enable task error:', error);
  }
}

// Export for use in server.js or as standalone script
export { autoEnableExpiredUsers };

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  autoEnableExpiredUsers().then(() => process.exit(0));
}