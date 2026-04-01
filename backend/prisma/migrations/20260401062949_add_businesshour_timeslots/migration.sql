-- AlterTable
ALTER TABLE "BusinessHour" ADD COLUMN     "timeSlots" TEXT[] DEFAULT ARRAY[]::TEXT[];
