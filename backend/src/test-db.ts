import 'dotenv/config';
import prisma from './prismaClient';

async function test() {
  try {
    console.log('Testing database connection...');
    
    // Test 1: Count users
    const userCount = await prisma.user.count();
    console.log(`✓ Total users in DB: ${userCount}`);
    
    // Test 2: Get all users with all fields
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        clientId: true,
      },
    });
    console.log(`✓ Users with role/clientId:`, JSON.stringify(users, null, 2));
    
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
