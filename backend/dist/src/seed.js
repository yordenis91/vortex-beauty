"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function seed() {
    try {
        console.log('🌱 Starting database seed...');
        // Crear usuario administrador
        const adminPassword = await bcryptjs_1.default.hash('admin123', 10);
        const admin = await prisma.user.upsert({
            where: { email: 'admin@vortexbeauty.com' },
            update: {},
            create: {
                email: 'admin@vortexbeauty.com',
                username: 'admin',
                password: adminPassword,
                name: 'Administrador',
                role: client_1.Role.ADMIN,
            },
        });
        console.log('✅ Admin user created:', admin.email);
        // Crear usuarios clientes
        const clients = [
            {
                email: 'cliente1@example.com',
                username: 'cliente1',
                password: await bcryptjs_1.default.hash('cliente123', 10),
                name: 'María García',
                role: client_1.Role.CLIENT,
            },
            {
                email: 'cliente2@example.com',
                username: 'cliente2',
                password: await bcryptjs_1.default.hash('cliente123', 10),
                name: 'Ana López',
                role: client_1.Role.CLIENT,
            },
            {
                email: 'cliente3@example.com',
                username: 'cliente3',
                password: await bcryptjs_1.default.hash('cliente123', 10),
                name: 'Carmen Rodríguez',
                role: client_1.Role.CLIENT,
            },
        ];
        for (const clientData of clients) {
            const client = await prisma.user.upsert({
                where: { email: clientData.email },
                update: {},
                create: clientData,
            });
            console.log('✅ Client user created:', client.email);
        }
        // Asegurar categoría y productos de ejemplo
        const defaultCategory = await prisma.category.upsert({
            where: { name_type: { name: 'Servicios', type: 'PRODUCT' } },
            update: {},
            create: {
                name: 'Servicios',
                description: 'Categoría de servicios de belleza',
                type: 'PRODUCT',
                color: '#6366f1',
                icon: 'Star',
                order: 1,
            },
        });
        const products = [
            {
                name: 'Manicura Básica',
                description: 'Servicio de manicura básica con esmaltado',
                price: 25.0,
            },
            {
                name: 'Manicura Francesa',
                description: 'Manicura con diseño francés elegante',
                price: 35.0,
            },
            {
                name: 'Pedicura Completa',
                description: 'Servicio completo de pedicura con masaje',
                price: 40.0,
            },
            {
                name: 'Tratamiento Facial',
                description: 'Tratamiento facial rejuvenecedor',
                price: 60.0,
            },
        ];
        for (const productData of products) {
            const existingProduct = await prisma.product.findFirst({ where: { name: productData.name } });
            if (!existingProduct) {
                const product = await prisma.product.create({
                    data: {
                        name: productData.name,
                        description: productData.description,
                        type: 'CUSTOM_DEVELOPMENT',
                        price: productData.price,
                        currency: 'USD',
                        billingCycle: 'ONE_TIME',
                        categoryId: defaultCategory.id,
                        userId: admin.id,
                    },
                });
                console.log('✅ Product created:', product.name);
            }
            else {
                console.log('⚪ Product exists:', existingProduct.name);
            }
        }
        // Crear horarios de negocio por defecto
        const businessHours = [
            { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isOpen: true }, // Lunes
            { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isOpen: true }, // Martes
            { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', isOpen: true }, // Miércoles
            { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', isOpen: true }, // Jueves
            { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isOpen: true }, // Viernes
            { dayOfWeek: 6, startTime: '09:00', endTime: '16:00', isOpen: true }, // Sábado
            { dayOfWeek: 0, startTime: '00:00', endTime: '00:00', isOpen: false }, // Domingo
        ];
        for (const hours of businessHours) {
            const existing = await prisma.businessHour.findFirst({
                where: { dayOfWeek: hours.dayOfWeek }
            });
            if (!existing) {
                await prisma.businessHour.create({ data: hours });
                console.log(`✅ Business hours created for day ${hours.dayOfWeek}`);
            }
        }
        console.log('🎉 Database seeded successfully!');
        console.log('\n📋 Credenciales de acceso:');
        console.log('Admin: admin@vortexbeauty.com / admin123');
        console.log('Clientes: cliente1@example.com, cliente2@example.com, cliente3@example.com / cliente123');
    }
    catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
seed();
