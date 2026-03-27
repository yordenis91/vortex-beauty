const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createCategories() {
  try {
    const categories = [
      { name: 'Getting Started', description: 'Basic guides and tutorials', type: 'KNOWLEDGE_BASE', color: '#3B82F6', icon: 'BookOpen', order: 1 },
      { name: 'Troubleshooting', description: 'Common issues and solutions', type: 'KNOWLEDGE_BASE', color: '#EF4444', icon: 'AlertTriangle', order: 2 },
      { name: 'Best Practices', description: 'Recommended practices', type: 'KNOWLEDGE_BASE', color: '#10B981', icon: 'CheckCircle', order: 3 }
    ];
    
    for (const cat of categories) {
      const existing = await prisma.category.findFirst({ where: { name: cat.name, type: cat.type } });
      if (!existing) {
        await prisma.category.create({ data: cat });
        console.log('Created:', cat.name);
      } else {
        console.log('Exists:', cat.name);
      }
    }
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createCategories();
