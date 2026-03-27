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
        let adminUser;
        if (existingAdmin) {
            console.log('✅ Usuario admin ya existe');
            adminUser = existingAdmin;
        }
        else {
            // Crear usuario admin por defecto
            const hashedPassword = await bcryptjs_1.default.hash('admin123', 10);
            adminUser = await prismaClient_1.default.user.create({
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
        // Crear categorías de knowledge base
        await seedKnowledgeBaseCategories(adminUser.id);
    }
    catch (error) {
        console.error('❌ Error creando usuario admin:', error);
    }
    finally {
        await prismaClient_1.default.$disconnect();
    }
}
async function seedKnowledgeBaseCategories(adminUserId) {
    try {
        const categories = [
            {
                name: 'Getting Started',
                description: 'Basic guides and tutorials for new users',
                type: 'KNOWLEDGE_BASE',
                color: '#3B82F6',
                icon: 'BookOpen',
                order: 1,
            },
            {
                name: 'Troubleshooting',
                description: 'Common issues and their solutions',
                type: 'KNOWLEDGE_BASE',
                color: '#EF4444',
                icon: 'AlertTriangle',
                order: 2,
            },
            {
                name: 'Best Practices',
                description: 'Recommended practices and guidelines',
                type: 'KNOWLEDGE_BASE',
                color: '#10B981',
                icon: 'CheckCircle',
                order: 3,
            },
            {
                name: 'API Documentation',
                description: 'Technical documentation and API references',
                type: 'KNOWLEDGE_BASE',
                color: '#8B5CF6',
                icon: 'Code',
                order: 4,
            },
        ];
        for (const category of categories) {
            const existingCategory = await prismaClient_1.default.category.findFirst({
                where: {
                    name: category.name,
                    type: category.type,
                },
            });
            if (!existingCategory) {
                await prismaClient_1.default.category.create({
                    data: category,
                });
                console.log(`✅ Categoría creada: ${category.name}`);
            }
            else {
                console.log(`ℹ️ Categoría ya existe: ${category.name}`);
            }
        }
        // Crear algunos artículos de ejemplo
        await seedSampleArticles(adminUserId);
    }
    catch (error) {
        console.error('❌ Error creando categorías de knowledge base:', error);
    }
}
async function seedSampleArticles(adminUserId) {
    try {
        // Obtener la categoría "Getting Started"
        const gettingStartedCategory = await prismaClient_1.default.category.findFirst({
            where: {
                name: 'Getting Started',
                type: 'KNOWLEDGE_BASE',
            },
        });
        if (!gettingStartedCategory) {
            console.log('❌ No se encontró la categoría Getting Started');
            return;
        }
        const articles = [
            {
                title: 'Welcome to Vortex',
                content: '# Welcome to Vortex\n\nVortex is a comprehensive CRM and billing system designed to help you manage your clients, projects, and invoices efficiently.\n\n## Getting Started\n\n1. **Create your first client** in the Clients section\n2. **Add products or services** in the Products section\n3. **Create projects** and assign them to clients\n4. **Generate invoices** for your work\n\n## Key Features\n\n- Client management\n- Project tracking\n- Invoice generation\n- Subscription management\n- Knowledge base\n- Support ticketing\n\nFor more detailed guides, check out our other articles in the knowledge base.',
                excerpt: 'A comprehensive guide to getting started with Vortex CRM',
                categoryId: gettingStartedCategory.id,
                isPublic: true,
            },
            {
                title: 'How to Create Your First Invoice',
                content: '# Creating Your First Invoice\n\nFollow these simple steps to create your first invoice in Vortex:\n\n## Step 1: Access the Invoices Section\n\nNavigate to the "Invoices" tab in the main navigation menu.\n\n## Step 2: Click "New Invoice"\n\nClick the "New Invoice" button in the top right corner.\n\n## Step 3: Fill in Client Information\n\nSelect an existing client or create a new one.\n\n## Step 4: Add Invoice Items\n\nAdd the products or services you want to bill for, including quantities and prices.\n\n## Step 5: Review and Send\n\nReview the invoice details and click "Create Invoice" to save it.\n\n## Tips\n\n- Make sure all client information is accurate\n- Double-check prices and calculations\n- Add clear descriptions for each line item\n- Set appropriate due dates',
                excerpt: 'Step-by-step guide to creating invoices in Vortex',
                categoryId: gettingStartedCategory.id,
                isPublic: true,
            },
        ];
        for (const article of articles) {
            const existingArticle = await prismaClient_1.default.knowledgeBase.findFirst({
                where: {
                    title: article.title,
                },
            });
            if (!existingArticle) {
                // Generate slug from title
                const slug = article.title
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');
                await prismaClient_1.default.knowledgeBase.create({
                    data: {
                        ...article,
                        slug,
                        userId: adminUserId,
                    },
                });
                console.log(`✅ Artículo creado: ${article.title}`);
            }
            else {
                console.log(`ℹ️ Artículo ya existe: ${article.title}`);
            }
        }
    }
    catch (error) {
        console.error('❌ Error creando artículos de ejemplo:', error);
    }
}
// Ejecutar el seed si se llama directamente
if (require.main === module) {
    seedAdmin();
}
exports.default = seedAdmin;
