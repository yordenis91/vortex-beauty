-- DropIndex
DROP INDEX "BusinessHour_dayOfWeek_key";

-- DropIndex
DROP INDEX "Category_name_type_key";

-- DropIndex
DROP INDEX "Client_email_key";

-- DropIndex
DROP INDEX "ClosedDate_date_key";

-- DropIndex
DROP INDEX "Invoice_invoiceNumber_key";

-- DropIndex
DROP INDEX "KnowledgeBase_slug_key";

-- DropIndex
DROP INDEX "ScheduleOverride_date_key";

-- DropIndex
DROP INDEX "Subscription_subscriptionNumber_key";

-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "BusinessHour" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Category" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ClosedDate" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "GalleryItem" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "KnowledgeBase" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ScheduleOverride" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Staff" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHour_tenantId_dayOfWeek_key" ON "BusinessHour"("tenantId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_name_type_key" ON "Category"("tenantId", "name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Client_tenantId_email_key" ON "Client"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "ClosedDate_tenantId_date_key" ON "ClosedDate"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_invoiceNumber_key" ON "Invoice"("tenantId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBase_tenantId_slug_key" ON "KnowledgeBase"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Project_tenantId_idx" ON "Project"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleOverride_tenantId_date_key" ON "ScheduleOverride"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_tenantId_subscriptionNumber_key" ON "Subscription"("tenantId", "subscriptionNumber");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

