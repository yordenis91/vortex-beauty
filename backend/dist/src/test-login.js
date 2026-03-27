"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prismaClient_1 = __importDefault(require("./prismaClient"));
async function testLogin() {
    try {
        console.log('Test 1: Finding user by email...');
        const user = await prismaClient_1.default.user.findUnique({
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
        const isValid = await bcryptjs_1.default.compare(testPassword, user.password);
        console.log(`✓ Password match: ${isValid}`);
        if (!isValid) {
            console.log('Note: Password does not match. Original password is likely different.');
            return;
        }
        console.log('\nTest 3: Signing JWT...');
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            role: user.role,
            clientId: user.clientId,
        }, process.env.JWT_SECRET, { expiresIn: '7d' });
        console.log('✓ JWT Token signed:', token.slice(0, 50) + '...');
        console.log('\nAll tests passed! The login flow should work.');
    }
    catch (error) {
        console.error('✗ Error:', error.message);
        console.error('Full error:', error);
    }
    finally {
        await prismaClient_1.default.$disconnect();
    }
}
testLogin();
