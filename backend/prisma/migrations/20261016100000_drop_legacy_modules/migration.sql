-- Fase 0: se eliminan los módulos heredados (facturación, proyectos, tickets,
-- base de conocimiento, suscripciones de clientas) y campos fiscales/de hosting.
-- Antes de colapsar Category.type se descartan las categorías que no eran de
-- servicios (TICKET / KNOWLEDGE_BASE), para que el unique (tenantId, name) no choque.
DELETE FROM "KnowledgeBase";
DELETE FROM "Ticket";
DELETE FROM "Category" WHERE "type" <> 'PRODUCT';

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_userId_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "KnowledgeBase" DROP CONSTRAINT "KnowledgeBase_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "KnowledgeBase" DROP CONSTRAINT "KnowledgeBase_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "KnowledgeBase" DROP CONSTRAINT "KnowledgeBase_userId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_userId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_productId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_userId_fkey";

-- DropForeignKey
ALTER TABLE "TicketMessage" DROP CONSTRAINT "TicketMessage_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "TicketMessage" DROP CONSTRAINT "TicketMessage_userId_fkey";

-- DropIndex
DROP INDEX "Category_tenantId_name_type_key";

-- DropIndex
DROP INDEX "Product_type_idx";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "type";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "businessNumber",
DROP COLUMN "company",
DROP COLUMN "groupId",
DROP COLUMN "ownerId",
DROP COLUMN "secondaryEmail",
DROP COLUMN "taxId",
DROP COLUMN "type";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "billingCycle",
DROP COLUMN "stock",
DROP COLUMN "type";

-- DropTable
DROP TABLE "Invoice";

-- DropTable
DROP TABLE "InvoiceItem";

-- DropTable
DROP TABLE "KnowledgeBase";

-- DropTable
DROP TABLE "OrderItem";

-- DropTable
DROP TABLE "Project";

-- DropTable
DROP TABLE "Subscription";

-- DropTable
DROP TABLE "Ticket";

-- DropTable
DROP TABLE "TicketMessage";

-- DropEnum
DROP TYPE "CategoryType";

-- DropEnum
DROP TYPE "ClientType";

-- DropEnum
DROP TYPE "InvoiceStatus";

-- DropEnum
DROP TYPE "KBStatus";

-- DropEnum
DROP TYPE "Priority";

-- DropEnum
DROP TYPE "ProductType";

-- DropEnum
DROP TYPE "ProjectStatus";

-- DropEnum
DROP TYPE "SubscriptionStatus";

-- DropEnum
DROP TYPE "TicketStatus";

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_name_key" ON "Category"("tenantId", "name");

