"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prismaClient_1 = __importDefault(require("./prismaClient"));
async function seedAdmin() {
    try {
        // Verificar si ya existe un usuario admin
        const existingAdmin = await prismaClient_1.default.user.findFirst({
            where: { email: 'admin@vortex.com' }
        });
        if (existingAdmin) {
            console.log('✅ Usuario admin ya existe');
            return;
        }
        // Crear usuario admin por defecto
        const hashedPassword = await bcryptjs_1.default.hash('admin123', 10);
        const adminUser = await prismaClient_1.default.user.create({
            data: {
                email: 'admin@vortex.com',
                password: hashedPassword,
                name: 'Administrator'
            },
            select: { id: true, email: true, name: true }
        });
        console.log('✅ Usuario admin creado exitosamente');
        console.log('📧 Email: admin@vortex.com');
        console.log('🔑 Password: admin123');
        console.log('👤 Nombre: Administrator');
    }
    catch (error) {
        console.error('❌ Error creando usuario admin:', error);
    }
    finally {
        await prismaClient_1.default.$disconnect();
    }
}
// Ejecutar el seed si se llama directamente
if (require.main === module) {
    seedAdmin();
}
exports.default = seedAdmin;
