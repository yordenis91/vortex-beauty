import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from './prismaClient';

async function testLogin() {
  try {
    console.log('Test 1: Finding user by email...');
    const user = await prisma.user.findUnique({ 
      where: { email: 'trabajonline91@gmail.com' },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        clientId: true,
      },
    });
    console.log('✓ User found:', user);

    if (!user) {
      console.error('✗ User not found');
      return;
    }

    console.log('\nTest 2: Comparing password...');
    const testPassword = 'password123';
    const isValid = await bcrypt.compare(testPassword, user.password);
    console.log(`✓ Password match: ${isValid}`);

    if (!isValid) {
      console.log('Note: Password does not match. Original password is likely different.');
      return;
    }

    console.log('\nTest 3: Signing JWT...');
    const token = jwt.sign(
      { 
        userId: user.id,
        role: user.role,
        clientId: user.clientId,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    console.log('✓ JWT Token signed:', token.slice(0, 50) + '...');

    console.log('\nAll tests passed! The login flow should work.');
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
