/**
 * Script to check database connection and view users
 */
import { prisma } from '../src/lib/prisma';
import { getUserCount, getActiveUsers, getAllUsers } from '../src/lib/auth/user-store';

async function checkDatabase() {
  try {
    console.log('🔍 Checking database connection...\n');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Successfully connected to database\n');
    
    // Get user statistics
    const totalUsers = await getUserCount();
    const activeUsers = await getActiveUsers(7);
    
    console.log('📊 Database Statistics:');
    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Active users (7 days): ${activeUsers}\n`);
    
    // Get all users
    if (totalUsers > 0) {
      console.log('👥 Users in database:');
      const users = await getAllUsers();
      users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.phoneNumber}`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Sessions: ${user.sessionCount}`);
        console.log(`      Last login: ${user.lastLogin}`);
        console.log(`      Created: ${user.createdAt}\n`);
      });
    } else {
      console.log('ℹ️  No users found. Database is empty (as expected for fresh setup).\n');
    }
    
    console.log('✅ Database check complete!');
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
