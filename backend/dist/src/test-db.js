"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prismaClient_1 = __importDefault(require("./prismaClient"));
async function test() {
    try {
        console.log('Testing database connection...');
        // Test 1: Count users
        const userCount = await prismaClient_1.default.user.count();
        console.log(`✓ Total users in DB: ${userCount}`);
        // Test 2: Get all users with all fields
        const users = await prismaClient_1.default.user.findMany({
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
    }
    catch (error) {
        console.error('✗ Error:', error.message);
        console.error('Full error:', error);
    }
    finally {
        await prismaClient_1.default.$disconnect();
    }
}
test();
